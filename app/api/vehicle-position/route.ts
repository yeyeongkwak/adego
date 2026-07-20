// Live GPS fix for one vehicle, by GTFS-R trip_id — powers the "where's my
// bus" bottom sheet. tripId comes from /api/arrivals's match (the specific
// trip a card's arrival was resolved against), not just the route number,
// so this points at the exact bus the user is about to board.

// Call: GET /api/vehicle-position?tripId=1134436

import { NextRequest, NextResponse } from 'next/server'
import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { VehiclePosition, VEHICLE_POSITIONS_URL } from '@/types/common'

export const runtime = 'nodejs'

// Vehicle positions move fast enough that a much shorter TTL than
// trip_updates' 30s is worth the extra feed fetches.
let feedCache: { at: number; entities: any[] } | null = null
const FEED_TTL_MS = 10_000

async function getFeed(): Promise<any[]> {
    if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) {
        return feedCache.entities
    }

    const res = await fetch(VEHICLE_POSITIONS_URL)
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
    const tripId = req.nextUrl.searchParams.get('tripId')
    if (!tripId) {
        return NextResponse.json({ error: 'tripId is required.' }, { status: 400 })
    }

    let entities: any[]
    try {
        entities = await getFeed()
    } catch {
        return NextResponse.json(
            { error: 'Failed to load the vehicle feed.' },
            { status: 502 }
        )
    }

    const match = entities.find((e) => e.vehicle?.trip?.tripId === tripId)
    if (!match?.vehicle?.position) {
        // Trip exists but hasn't reported GPS yet (or already finished).
        return NextResponse.json(
            { error: 'No live position for this trip.' },
            { status: 404 }
        )
    }

    const { latitude, longitude, bearing } = match.vehicle.position
    const position: VehiclePosition = {
        lat: latitude,
        lng: longitude,
        bearing: bearing ?? null,
        updatedAtSec: Number(match.vehicle.timestamp ?? 0),
    }

    return NextResponse.json(position)
}
