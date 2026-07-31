// Real-time arrivals from the Adelaide Metro GTFS-R feed.
// This is the whole point of the app: Google gives scheduled times,
// we give "actually 5 minutes away".

// Call: GET /api/arrivals?stops=Stop Q1 Hutt St - West side&routes=820
//       (stops/routes are comma-separated, paired by index)

// Needs: GTFS-R feed (public) + gtfs_stops table for name -> stop_id.

import { NextRequest, NextResponse } from 'next/server'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { Arrival, TRIP_UPDATES_URL } from '@/types/common'
import { createPublicClient } from '@/util/supabase/public'
import { scheduledTimeToMs } from '@/util/gtfs/schedule'

export const runtime = 'nodejs'

// ---- Feed cache -----------------------------------------------------
// The feed covers the whole city (a few MB) and refreshes every ~60s.
// Fetching it once per request would be wasteful, so cache it in memory.
let feedCache: { at: number; entities: any[] } | null = null
const FEED_TTL_MS = 30_000

async function getFeed(): Promise<any[]> {
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

// ---- Stop name -> stop_id ------------------------------------------
// Google returns the stop NAME ("Stop Q1 Hutt St - West side"), the feed
// speaks stop_id ("3654"). Adelaide's names match ours exactly because
// both come from the same GTFS static feed.
async function resolveStopIds(
    stopNames: string[]
): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    if (stopNames.length === 0) return map

    const supabase = createPublicClient()
    if (!supabase) return map

    const { data } = await supabase
        .from('gtfs_stops')
        .select('stop_id, stop_name')
        .in('stop_name', stopNames)

    for (const row of data ?? []) {
        map.set(row.stop_name, row.stop_id)
    }
    return map
}

// ---- Scheduled (trip_id, stop_id) -> timetable arrival/departure ----

async function resolveScheduledTimes(
    tripIds: string[],
    stopIds: string[]
): Promise<Map<string, { arrival: string | null; departure: string | null }>> {
    const map = new Map<
        string,
        { arrival: string | null; departure: string | null }
    >()
    if (tripIds.length === 0 || stopIds.length === 0) return map

    const supabase = createPublicClient()
    if (!supabase) return map

    const { data } = await supabase
        .from('gtfs_stop_times')
        .select('trip_id, stop_id, arrival_time, departure_time')
        .in('trip_id', tripIds)
        .in('stop_id', stopIds)

    for (const row of (data ?? []) as any[]) {
        map.set(`${row.trip_id}|${row.stop_id}`, {
            arrival: row.arrival_time ?? null,
            departure: row.departure_time ?? null,
        })
    }
    return map
}

export async function GET(req: NextRequest) {
    const stopsParam = req.nextUrl.searchParams.get('stops')
    const routesParam = req.nextUrl.searchParams.get('routes')

    if (!stopsParam || !routesParam) {
        return NextResponse.json(
            {
                error: 'stops and routes are required (comma-separated, paired).',
            },
            { status: 400 }
        )
    }

    const stopNames = stopsParam.split(',').map((s) => s.trim())
    const routeNames = routesParam.split(',').map((s) => s.trim())

    if (stopNames.length !== routeNames.length) {
        return NextResponse.json(
            { error: 'stops and routes must have the same length.' },
            { status: 400 }
        )
    }

    // 1) Resolve stop names to GTFS stop_ids
    let stopIdMap: Map<string, string>
    try {
        stopIdMap = await resolveStopIds([...new Set(stopNames)])
    } catch {
        return NextResponse.json(
            { error: 'Failed to resolve stops.' },
            { status: 502 }
        )
    }

    // 2) Pull the realtime feed
    let entities: any[]
    try {
        entities = await getFeed()
    } catch {
        // Feed down -> return no realtime, UI falls back to scheduled times.
        return NextResponse.json({
            arrivals: stopNames.map((stopName, i) => ({
                stopName,
                routeName: routeNames[i],
                times: [],
            })),
        })
    }

    const now = Date.now()

    // 3) For each (stop, route) pair, collect every upcoming match in the
    // feed (soonest first) — not just the single soonest one. Two different
    // route options can board the exact same (stop, route) pair at
    // different times ("catch this 174" vs. "catch the next 174"), and each
    // needs its own distinct upcoming arrival rather than all of them
    // collapsing onto the single earliest match.
    const MAX_TIMES_PER_PAIR = 5

    type Match = {
        ms: number
        feedDelay: number
        tripId: string | null
        stopId: string
        viaArrival: boolean
    }

    const matchLists: Match[][] = stopNames.map((stopName, i) => {
        const routeName = routeNames[i]
        const stopId = stopIdMap.get(stopName)
        if (!stopId) return []

        const found: Match[] = []

        for (const entity of entities) {
            const tu = entity.tripUpdate
            if (!tu) continue

            // The feed's route_id is the human route number in Adelaide ("820").
            const feedRoute = tu.trip?.routeId
            if (feedRoute !== routeName) continue

            for (const stu of tu.stopTimeUpdate ?? []) {
                if (stu.stopId !== stopId) continue

                // arrival.time is a Long -> convert. Fall back to departure.
                const viaArrival = stu.arrival?.time != null
                const t = stu.arrival?.time ?? stu.departure?.time
                if (t == null) continue

                const ms = Number(t) * 1000
                if (ms < now - 60_000) continue // already gone (>1 min ago)

                const feedDelay = Number(
                    stu.arrival?.delay ?? stu.departure?.delay ?? 0
                )

                found.push({
                    ms,
                    feedDelay,
                    tripId: tu.trip?.tripId ?? null,
                    stopId,
                    viaArrival,
                })
            }
        }

        found.sort((a, b) => a.ms - b.ms)
        return found.slice(0, MAX_TIMES_PER_PAIR)
    })

    // 4) Diff the feed's predicted time against the static timetable for the
    // actual delay -> the feed itself almost never sets StopTimeUpdate.delay.
    const allMatches = matchLists.flat()
    const tripIds = [
        ...new Set(
            allMatches
                .map((m) => m.tripId)
                .filter((v): v is string => v != null)
        ),
    ]
    const stopIds = [...new Set(allMatches.map((m) => m.stopId))]
    const scheduleMap = await resolveScheduledTimes(tripIds, stopIds)

    const arrivals = stopNames.map((stopName, i) => {
        const routeName = routeNames[i]
        const times: Omit<Arrival, 'stopName' | 'routeName'>[] = matchLists[
            i
        ].map((best) => {
            let delaySeconds = best.feedDelay
            if (best.tripId) {
                const sched = scheduleMap.get(`${best.tripId}|${best.stopId}`)
                const schedTime = best.viaArrival
                    ? (sched?.arrival ?? sched?.departure)
                    : (sched?.departure ?? sched?.arrival)
                if (schedTime) {
                    const schedMs = scheduledTimeToMs(schedTime, best.ms)
                    delaySeconds = Math.round((best.ms - schedMs) / 1000)
                }
            }

            return {
                minutesUntil: Math.max(0, Math.round((best.ms - now) / 60_000)),
                delaySeconds,
                isRealtime: true,
                tripId: best.tripId,
            }
        })

        return { stopName, routeName, times }
    })

    return NextResponse.json({ arrivals })
}
