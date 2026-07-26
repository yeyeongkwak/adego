// Call: GET /api/stops-arrivals?stopId=3654

import { NextRequest, NextResponse } from 'next/server'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { StopArrival, TRIP_UPDATES_URL } from '@/types/common'
import { createPublicClient } from '@/util/supabase/public'
import { adelaideParts, gtfsTimeString } from '@/util/gtfs/schedule'

export const runtime = 'nodejs'

// route_id in the realtime feed is already the human route number ("820"),
// same as gtfs_routes.route_id — no name resolution needed, just a lookup.
async function resolveRouteColors(
    routeIds: string[]
): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    if (routeIds.length === 0) return map

    const supabase = createPublicClient()
    if (!supabase) return map

    const { data } = await supabase
        .from('gtfs_routes')
        .select('route_id, route_color')
        .in('route_id', routeIds)

    for (const row of data ?? []) {
        if (row.route_color) map.set(row.route_id, `#${row.route_color}`)
    }
    return map
}

let feedCache: { at: number; entities: any[] } | null = null
const FEED_TTL_MS = 30_000

async function getFeed() {
    if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) {
        return feedCache.entities
    }

    const res = await fetch(TRIP_UPDATES_URL)
    if (!res.ok) throw new Error(`GTFS-R feed error: ${res.status}`)

    const buffer = await res.arrayBuffer()
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer)
    )

    const entities = feed.entity ?? []
    feedCache = { at: Date.now(), entities }
    return entities
}

async function todaysScheduledTrips(
    stopId: string,
    referenceMs: number,
    windowMinutes?: number
): Promise<{
    trips: { tripId: string; routeId: string; ms: number }[]
    hasMore: boolean
}> {
    const supabase = createPublicClient()
    if (!supabase) return { trips: [], hasMore: false }

    const { dateStr, dayColumn, secondsSinceMidnight } =
        adelaideParts(referenceMs)
    const midnightMs = referenceMs - secondsSinceMidnight * 1000

    const { data: calendarRows } = await supabase
        .from('gtfs_calendar')
        .select('service_id')
        .eq(dayColumn, true)
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)

    const serviceIds = new Set(
        (calendarRows ?? []).map((r: any) => r.service_id as string)
    )
    if (serviceIds.size === 0) return { trips: [], hasMore: false }

    let toStr: string | null = null
    let stopTimesQuery = supabase
        .from('gtfs_stop_times')
        .select('trip_id, arrival_time, departure_time')
        .eq('stop_id', stopId)

    if (windowMinutes != null) {
        const toSec = secondsSinceMidnight + windowMinutes * 60
        const fromStr = gtfsTimeString(secondsSinceMidnight)
        toStr = gtfsTimeString(toSec)
        stopTimesQuery = stopTimesQuery.or(
            `and(arrival_time.gte.${fromStr},arrival_time.lte.${toStr}),and(departure_time.gte.${fromStr},departure_time.lte.${toStr})`
        )
    }

    const { data: stopTimeRows } = await stopTimesQuery

    const results: { tripId: string; routeId: string; ms: number }[] = []
    if (stopTimeRows?.length) {
        const tripIds = [
            ...new Set(stopTimeRows.map((r: any) => r.trip_id as string)),
        ]

        const { data: tripRows } = await supabase
            .from('gtfs_trips')
            .select('trip_id, route_id, service_id')
            .in('trip_id', tripIds)

        const tripInfo = new Map(
            (tripRows ?? []).map((t: any) => [t.trip_id as string, t])
        )

        for (const row of stopTimeRows as any[]) {
            const trip = tripInfo.get(row.trip_id)
            if (!trip?.route_id || !serviceIds.has(trip.service_id)) continue

            const timeStr = row.arrival_time ?? row.departure_time
            if (!timeStr) continue

            const [h, m, s] = timeStr.split(':').map(Number)
            const ms = midnightMs + (h * 3600 + m * 60 + s) * 1000
            if (ms < referenceMs - 60_000) continue

            results.push({ tripId: row.trip_id, routeId: trip.route_id, ms })
        }
    }

    let hasMore = false
    if (toStr) {
        const windowedRouteIds = new Set(results.map((r) => r.routeId))
        const { data: beyondRows } = await supabase
            .from('gtfs_stop_times')
            .select('trip_id')
            .eq('stop_id', stopId)
            .or(`arrival_time.gt.${toStr},departure_time.gt.${toStr}`)
            .limit(20)

        const beyondTripIds = [
            ...new Set((beyondRows ?? []).map((r: any) => r.trip_id as string)),
        ]
        if (beyondTripIds.length > 0) {
            const { data: beyondTrips } = await supabase
                .from('gtfs_trips')
                .select('route_id, service_id')
                .in('trip_id', beyondTripIds)
            hasMore = (beyondTrips ?? []).some(
                (t: any) =>
                    serviceIds.has(t.service_id) &&
                    !windowedRouteIds.has(t.route_id)
            )
        }
    }

    return { trips: results, hasMore }
}

export async function GET(req: NextRequest) {
    const stopId = req.nextUrl.searchParams.get('stopId')
    if (!stopId) {
        return NextResponse.json(
            { error: 'stopId is required.' },
            { status: 400 }
        )
    }

    const withinMinutesParam = req.nextUrl.searchParams.get('withinMinutes')
    const withinMinutes = withinMinutesParam
        ? parseInt(withinMinutesParam, 10)
        : undefined

    const now = Date.now()

    // 1) Static timetable: every trip due here today, live or not.
    const { trips, hasMore } = await todaysScheduledTrips(
        stopId,
        now,
        withinMinutes
    )

    // 2) Realtime feed: live time + delay, keyed by trip_id.
    let entities: any[] = []
    try {
        entities = await getFeed()
    } catch {
        // Feed down -> fall through on schedule-only data below.
    }

    const liveByTrip = new Map<string, { ms: number; delay: number }>()
    for (const entity of entities) {
        const tu = entity.tripUpdate
        const tripId = tu?.trip?.tripId
        if (!tripId) continue

        for (const stu of tu.stopTimeUpdate ?? []) {
            if (stu.stopId !== stopId) continue

            const t = stu.arrival?.time ?? stu.departure?.time
            if (t == null) continue

            const ms = Number(t) * 1000
            if (ms < now - 60_000) continue // already gone (>1 min ago)

            const delay = Number(
                stu.arrival?.delay ?? stu.departure?.delay ?? 0
            )
            liveByTrip.set(tripId, { ms, delay })
            break
        }
    }

    // The feed sometimes knows about a trip the static join missed entirely
    // (added trip, calendar gap) — fold those in too, using the route id the
    // feed itself carries, so nothing that used to show up disappears.
    const knownTripIds = new Set(trips.map((t) => t.tripId))
    for (const entity of entities) {
        const tu = entity.tripUpdate
        const tripId = tu?.trip?.tripId
        const routeId = tu?.trip?.routeId
        if (!tripId || !routeId || knownTripIds.has(tripId)) continue

        const live = liveByTrip.get(tripId)
        if (!live) continue
        if (withinMinutes != null && live.ms > now + withinMinutes * 60_000)
            continue
        trips.push({ tripId, routeId, ms: live.ms })
    }

    // 3) Every upcoming departure per route — live time/delay when the feed
    // has a match for that trip, otherwise the scheduled time. Capped per
    // route so the response stays small even though a route can have many
    // trips queued up (the accordion on the client needs a handful, not the
    // whole day's timetable).
    const MAX_TIMES_PER_ROUTE = 5

    type Best = { ms: number; delay: number; isRealtime: boolean }
    const timesByRoute = new Map<string, Best[]>()

    for (const trip of trips) {
        const live = liveByTrip.get(trip.tripId)
        const candidate: Best = live
            ? { ms: live.ms, delay: live.delay, isRealtime: true }
            : { ms: trip.ms, delay: 0, isRealtime: false }

        const list = timesByRoute.get(trip.routeId)
        if (list) list.push(candidate)
        else timesByRoute.set(trip.routeId, [candidate])
    }

    // Sorting chronologically (rather than live-first) is what actually
    // surfaces live entries first in practice — the feed only predicts a
    // short horizon ahead, so a live match is almost always among the
    // soonest few anyway, and a strict "live first" order would otherwise
    // scramble the list out of departure order.
    for (const list of timesByRoute.values()) {
        list.sort((a, b) => a.ms - b.ms)
        list.length = Math.min(list.length, MAX_TIMES_PER_ROUTE)
    }

    const routeIds = Array.from(timesByRoute.keys()).sort(
        (a, b) => timesByRoute.get(a)![0].ms - timesByRoute.get(b)![0].ms
    )

    const routeColors = await resolveRouteColors(routeIds)

    const arrivals: StopArrival[] = routeIds.map((routeName) => ({
        routeName,
        routeColor: routeColors.get(routeName) ?? null,
        times: timesByRoute.get(routeName)!.map((t) => ({
            minutesUntil: Math.max(0, Math.round((t.ms - now) / 60_000)),
            delaySeconds: t.delay,
            isRealtime: t.isRealtime,
        })),
    }))

    return NextResponse.json({ arrivals, hasMore })
}
