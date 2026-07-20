// Real-time arrivals from the Adelaide Metro GTFS-R feed.
// This is the whole point of the app: Google gives scheduled times,
// we give "actually 5 minutes away".

// Call: GET /api/arrivals?stops=Stop Q1 Hutt St - West side&routes=820
//       (stops/routes are comma-separated, paired by index)

// Needs: GTFS-R feed (public) + gtfs_stops table for name -> stop_id.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { Arrival, TRIP_UPDATES_URL } from '@/types/common'

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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return map

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await supabase
        .from('gtfs_stops')
        .select('stop_id, stop_name')
        .in('stop_name', stopNames)

    for (const row of (data ?? []) as any[]) {
        map.set(row.stop_name, row.stop_id)
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
                minutesUntil: null,
                delaySeconds: null,
                isRealtime: false,
            })),
        })
    }

    const now = Date.now()

    // 3) For each (stop, route) pair, find the soonest arrival in the feed
    const arrivals: Arrival[] = stopNames.map((stopName, i) => {
        const routeName = routeNames[i]
        const stopId = stopIdMap.get(stopName)

        const empty: Arrival = {
            stopName,
            routeName,
            minutesUntil: null,
            delaySeconds: null,
            isRealtime: false,
            tripId: null,
        }
        if (!stopId) return empty

        let best: { ms: number; delay: number; tripId: string | null } | null =
            null

        for (const entity of entities) {
            const tu = entity.tripUpdate
            if (!tu) continue

            // The feed's route_id is the human route number in Adelaide ("820").
            const feedRoute = tu.trip?.routeId
            if (feedRoute !== routeName) continue

            for (const stu of tu.stopTimeUpdate ?? []) {
                if (stu.stopId !== stopId) continue

                // arrival.time is a Long -> convert. Fall back to departure.
                const t = stu.arrival?.time ?? stu.departure?.time
                if (t == null) continue

                const ms = Number(t) * 1000
                if (ms < now - 60_000) continue // already gone (>1 min ago)

                const delay = Number(
                    stu.arrival?.delay ?? stu.departure?.delay ?? 0
                )

                if (!best || ms < best.ms) {
                    best = { ms, delay, tripId: tu.trip?.tripId ?? null }
                }
            }
        }

        if (!best) return empty

        return {
            stopName,
            routeName,
            minutesUntil: Math.max(0, Math.round((best.ms - now) / 60_000)),
            delaySeconds: best.delay,
            isRealtime: true,
            tripId: best.tripId,
        }
    })

    return NextResponse.json({ arrivals })
}
