// Next few buses at ONE stop, any route — for the map's stop popup.
// Unlike /api/arrivals, we don't need to know the (stop, route) pairs in
// advance: the stop_id alone is enough since the GTFS-R feed carries the
// route on every trip update.

// Call: GET /api/stops-arrivals?stopId=3654

import { NextRequest, NextResponse } from 'next/server'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { StopArrival, TRIP_UPDATES_URL } from '@/types/common'
import { createPublicClient } from '@/util/supabase/public'

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

    for (const row of (data ?? []) as any[]) {
        if (row.route_color) map.set(row.route_id, `#${row.route_color}`)
    }
    return map
}

// Separate in-memory cache from /api/arrivals's — different route module,
// not worth sharing across the two for this feed's size/TTL.
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

export async function GET(req: NextRequest) {
    const stopId = req.nextUrl.searchParams.get('stopId')
    if (!stopId) {
        return NextResponse.json(
            { error: 'stopId is required.' },
            { status: 400 }
        )
    }

    let entities: any[]
    try {
        entities = await getFeed()
    } catch {
        // Feed down -> no realtime, UI shows "no upcoming arrivals" instead of erroring.
        return NextResponse.json({ arrivals: [] })
    }

    const now = Date.now()

    // Soonest arrival per route at this stop (a route can have several
    // trips queued up — the popup only needs "next 820", not every one).
    const bestByRoute = new Map<string, { ms: number; delay: number }>()

    for (const entity of entities) {
        const tu = entity.tripUpdate
        if (!tu) continue

        const routeName = tu.trip?.routeId
        if (!routeName) continue

        for (const stu of tu.stopTimeUpdate ?? []) {
            if (stu.stopId !== stopId) continue

            const t = stu.arrival?.time ?? stu.departure?.time
            if (t == null) continue

            const ms = Number(t) * 1000
            if (ms < now - 60_000) continue // already gone (>1 min ago)

            const delay = Number(
                stu.arrival?.delay ?? stu.departure?.delay ?? 0
            )

            const existing = bestByRoute.get(routeName)
            if (!existing || ms < existing.ms) {
                bestByRoute.set(routeName, { ms, delay })
            }
        }
    }

    const top = Array.from(bestByRoute.entries())
        .sort((a, b) => a[1].ms - b[1].ms)
        .slice(0, 8)

    const routeColors = await resolveRouteColors(top.map(([name]) => name))

    const arrivals: StopArrival[] = top.map(([routeName, { ms, delay }]) => ({
        routeName,
        routeColor: routeColors.get(routeName) ?? null,
        minutesUntil: Math.max(0, Math.round((ms - now) / 60_000)),
        delaySeconds: delay,
        isRealtime: true,
    }))

    return NextResponse.json({ arrivals })
}
