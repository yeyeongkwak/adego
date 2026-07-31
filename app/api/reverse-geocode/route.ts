// Convert standardized (lat, lng) → actual address (formatted_address) (reverse geocoding).
// Click "Current Location" to change the city registration to "240 Hutt St, Adelaide SA 5000".
// Call: GET /api/reverse-geocode?lat=-34.93&lng=138.61
// Require: GOOGLE_MAPS_API_KEY in .env.local (for server, Geocoding + Places API enabled)

import { NextRequest, NextResponse } from 'next/server'
import { distanceMeters } from '@/util/map/distance'

const POI_MATCH_RADIUS_M = 25

async function findNearbyPlaceName(
    lat: number,
    lng: number,
    key: string
): Promise<string | null> {
    try {
        const res = await fetch(
            'https://places.googleapis.com/v1/places:searchNearby',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': key,
                    'X-Goog-FieldMask': 'places.displayName,places.location',
                },
                body: JSON.stringify({
                    maxResultCount: 1,
                    rankPreference: 'DISTANCE',
                    locationRestriction: {
                        circle: {
                            center: { latitude: lat, longitude: lng },
                            radius: POI_MATCH_RADIUS_M,
                        },
                    },
                }),
            }
        )
        const data = await res.json()
        const place = data.places?.[0]
        if (!place?.displayName?.text || !place.location) return null

        const distance = distanceMeters(
            lat,
            lng,
            place.location.latitude,
            place.location.longitude
        )
        return distance <= POI_MATCH_RADIUS_M ? place.displayName.text : null
    } catch {
        return null
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const latStr = searchParams.get('lat')
    const lngStr = searchParams.get('lng')

    if (!latStr || !lngStr) {
        return NextResponse.json(
            { error: 'lat, lng are required' },
            { status: 400 }
        )
    }

    const lat = Number(latStr)
    const lng = Number(lngStr)

    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key) {
        return NextResponse.json(
            { error: 'GOOGLE_MAPS_API_KEY is required' },
            { status: 500 }
        )
    }

    const geocodeUrl = new URL(
        'https://maps.googleapis.com/maps/api/geocode/json'
    )
    geocodeUrl.searchParams.set('latlng', `${lat},${lng}`)
    geocodeUrl.searchParams.set('region', 'au')
    geocodeUrl.searchParams.set('key', key)

    let data: any
    let placeName: string | null
    try {
        ;[data, placeName] = await Promise.all([
            fetch(geocodeUrl.toString()).then((r) => r.json()),
            findNearbyPlaceName(lat, lng, key),
        ])
    } catch {
        return NextResponse.json(
            { error: 'Failed to request to Google.' },
            { status: 502 }
        )
    }

    if (data.status !== 'OK' || !data.results?.length) {
        // Set address: null if address doesn't exist in Google
        return NextResponse.json({ address: null, status: data.status })
    }

    // First result is the most accurate address
    const address = data.results[0].formatted_address
    return NextResponse.json({ address, placeName })
}
