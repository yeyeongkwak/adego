// List of bus stops near the coordinates (gtfs_stops table).
// Returns stops narrowed by latitude and longitude bounding boxes and sorted by harbor sine distance, in order of closest.
// Call: GET /api/stops-nearby?lat=-34.93&lng=138.60&radius=600&limit=25

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { NearbyStop } from '@/types/common'

const DEFAULT_RADIUS_M = 600
const MAX_RADIUS_M = 3000
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

function distanceM(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
}

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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) {
        return NextResponse.json(
            { error: 'Missing Supabase config.' },
            { status: 500 }
        )
    }

    // 바운딩 박스: 위도 1도 ≈ 111.32km, 경도는 위도에 따라 보정
    const dLat = radius / 111320
    const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180))

    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await supabase
        .from('gtfs_stops')
        .select('stop_id, stop_code, stop_name, stop_lat, stop_lon')
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
                distanceM(lat, lng, r.stop_lat as number, r.stop_lon as number)
            ),
        }))
        .filter((s) => s.distanceM <= radius)
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, limit)

    return NextResponse.json({ stops })
}
