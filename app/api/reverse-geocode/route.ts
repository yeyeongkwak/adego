// Convert standardized (lat, lng) → actual address (formatted_address) (reverse geocoding).
// Click "Current Location" to change the city registration to "240 Hutt St, Adelaide SA 5000".
// Call: GET /api/reverse-geocode?lat=-34.93&lng=138.61
// Require: GOOGLE_MAPS_API_KEY in .env.local (for server, Geocoding API enabled)

import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!lat || !lng) {
        return NextResponse.json(
            { error: 'lat, lng are required' },
            { status: 400 }
        )
    }

    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key) {
        return NextResponse.json(
            { error: 'GOOGLE_MAPS_API_KEY is required' },
            { status: 500 }
        )
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('latlng', `${lat},${lng}`)
    url.searchParams.set('region', 'au')
    url.searchParams.set('key', key)

    let data: any
    try {
        const res = await fetch(url.toString())
        data = await res.json()
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
    return NextResponse.json({ address })
}
