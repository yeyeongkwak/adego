// Given a placeId (from autocomplete) + the same sessionToken used for those
// autocomplete calls, return its lat/lng + address via Place Details.
// Passing sessionToken here is what closes the session, so Google bills the
// whole search-and-select as one session instead of N separate requests.

// Call: GET /api/place-coords?placeId=ChIJ...&sessionToken=...
// Needs: Places API (New) enabled + GOOGLE_MAPS_API_KEY

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const placeId = req.nextUrl.searchParams.get('placeId')
    const sessionToken =
        req.nextUrl.searchParams.get('sessionToken') ?? undefined
    if (!placeId) {
        return NextResponse.json(
            { error: 'placeId is required.' },
            { status: 400 }
        )
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
        return NextResponse.json(
            { error: 'Missing server API key.' },
            { status: 500 }
        )
    }

    const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`)
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken)

    let data: any
    try {
        const res = await fetch(url.toString(), {
            headers: {
                'X-Goog-Api-Key': apiKey,
                // Only ask for the fields we render -> cheapest Place Details tier.
                'X-Goog-FieldMask': 'location,formattedAddress',
            },
        })
        data = await res.json()

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: 'Place details failed',
                    detail: data?.error?.message ?? null,
                },
                { status: 502 }
            )
        }
    } catch {
        return NextResponse.json({ error: 'Network error.' }, { status: 502 })
    }

    return NextResponse.json({
        lat: data.location?.latitude,
        lng: data.location?.longitude,
        address: data.formattedAddress,
    })
}
