// Search gtfs_stops by name — powers the Stops tab's search box so users can
// Find a specific stop directly, instead of going through a route search.

// Call: GET /api/stops-search?query=q1

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/util/supabase/public'
import { NearbyStop, stopModeFromRouteType } from '@/types/common'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 30

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('query')?.trim()
    if (!query) {
        return NextResponse.json({ stops: [] })
    }

    const limit = Math.min(
        parseInt(req.nextUrl.searchParams.get('limit') ?? '', 10) ||
            DEFAULT_LIMIT,
        MAX_LIMIT
    )

    const supabase = createPublicClient()
    if (!supabase) {
        return NextResponse.json(
            { error: 'Missing Supabase config.' },
            { status: 500 }
        )
    }

    const { data, error } = await supabase
        .from('gtfs_stops')
        .select('stop_id, stop_code, stop_name, stop_lat, stop_lon, route_type')
        .ilike('stop_name', `%${query}%`)
        .limit(limit)

    if (error) {
        return NextResponse.json(
            { error: 'Failed to search stops', detail: error.message },
            { status: 502 }
        )
    }

    const stops: NearbyStop[] = (data ?? [])
        .filter((r) => r.stop_lat != null && r.stop_lon != null)
        .map((r) => ({
            id: String(r.stop_id),
            code: r.stop_code ?? null,
            name: r.stop_name ?? '',
            lat: r.stop_lat as number,
            lng: r.stop_lon as number,
            mode: stopModeFromRouteType(r.route_type as number | null),
        }))

    return NextResponse.json({ stops })
}
