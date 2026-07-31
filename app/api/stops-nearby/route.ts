// List of bus stops near the coordinates (gtfs_stops table).
// Returns stops narrowed by latitude and longitude bounding boxes and sorted by harbor sine distance, in order of closest.
// Call: GET /api/stops-nearby?lat=-34.93&lng=138.60&radius=600&limit=25

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/util/supabase/public'
import { distanceMeters } from '@/util/map/distance'
import { NearbyStop, stopModeFromRouteType } from '@/types/common'

const DEFAULT_RADIUS_M = 600
const MAX_RADIUS_M = 3000
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

export async function GET(req: NextRequest) {
    const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '')
    const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '')

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json(
            { error: 'lat, lng are required' },
            { status: 400 }
        )
    }

    const radius = Math.min(
        parseFloat(req.nextUrl.searchParams.get('radius') ?? '') ||
            DEFAULT_RADIUS_M,
        MAX_RADIUS_M
    )
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

    // 바운딩 박스: 위도 1도 ≈ 111.32km, 경도는 위도에 따라 보정
    const dLat = radius / 111320
    const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180))

    const { data, error } = await supabase
        .from('gtfs_stops')
        .select('stop_id, stop_code, stop_name, stop_lat, stop_lon, route_type')
        .gte('stop_lat', lat - dLat)
        .lte('stop_lat', lat + dLat)
        .gte('stop_lon', lng - dLng)
        .lte('stop_lon', lng + dLng)

    if (error) {
        return NextResponse.json(
            { error: 'Failed to query stops', detail: error.message },
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
            distanceM: Math.round(
                distanceMeters(
                    lat,
                    lng,
                    r.stop_lat as number,
                    r.stop_lon as number
                )
            ),
            mode: stopModeFromRouteType(r.route_type as number | null),
        }))
        .filter((s) => s.distanceM <= radius)
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, limit)

    return NextResponse.json({ stops })
}
