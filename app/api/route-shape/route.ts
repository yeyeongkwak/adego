// Full GTFS shape for a trip — the line the vehicle drives end to end
// (trip_id -> gtfs_trips.shape_id -> ordered gtfs_shapes points)

// Call: GET /api/route-shape?tripId=1134436

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/util/supabase/public'

export async function GET(req: NextRequest) {
    const tripId = req.nextUrl.searchParams.get('tripId')
    if (!tripId) {
        return NextResponse.json(
            { error: 'tripId is required.' },
            { status: 400 }
        )
    }

    const supabase = createPublicClient()
    if (!supabase) {
        return NextResponse.json(
            { error: 'Missing Supabase config.' },
            { status: 500 }
        )
    }

    const { data: trip, error: tripError } = await supabase
        .from('gtfs_trips')
        .select('shape_id')
        .eq('trip_id', tripId)
        .maybeSingle()

    if (tripError) {
        return NextResponse.json(
            { error: 'Failed to look up trip', detail: tripError.message },
            { status: 502 }
        )
    }
    if (!trip?.shape_id) {
        return NextResponse.json(
            { error: 'No shape for this trip.' },
            { status: 404 }
        )
    }

    const { data, error } = await supabase
        .from('gtfs_shapes')
        .select('shape_pt_lat, shape_pt_lon')
        .eq('shape_id', trip.shape_id)
        .order('shape_pt_sequence', { ascending: true })

    if (error) {
        return NextResponse.json(
            { error: 'Failed to load shape', detail: error.message },
            { status: 502 }
        )
    }

    const path = (data ?? []).map((r) => ({
        lat: r.shape_pt_lat as number,
        lng: r.shape_pt_lon as number,
    }))

    return NextResponse.json({ path })
}
