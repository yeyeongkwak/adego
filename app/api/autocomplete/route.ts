import { NextRequest, NextResponse } from 'next/server'
import { Prediction } from '@/types/common'

// Set Default Boundaries => Adelaide CBD
const ADELAIDE = { latitude: -34.9285, longitude: 138.6007 }

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get('q')?.trim()
    const sessionToken =
        req.nextUrl.searchParams.get('sessionToken') ?? undefined

    // Empty query -> empty list (don't call Google for nothing).
    if (!q) return NextResponse.json({ predictions: [] })

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
        return NextResponse.json(
            { error: 'Missing server API key.' },
            { status: 500 }
        )
    }

    let data: any
    try {
        const res = await fetch(
            'https://places.googleapis.com/v1/places:autocomplete',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    // Only ask for the fields we render -> cheaper + smaller response.
                    'X-Goog-FieldMask':
                        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
                },
                body: JSON.stringify({
                    input: q,
                    includedRegionCodes: ['au'], // Australia only
                    locationBias: {
                        circle: { center: ADELAIDE, radius: 50000.0 }, // ~50km around Adelaide
                    },
                    ...(sessionToken ? { sessionToken } : {}),
                }),
            }
        )
        data = await res.json()

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: 'Autocomplete failed',
                    detail: data?.error?.message ?? null,
                },
                { status: 502 }
            )
        }
    } catch {
        return NextResponse.json({ error: 'Network error.' }, { status: 502 })
    }

    // Flatten Google's response into a simple list our UI can map over.
    const predictions: Prediction[] = (data.suggestions ?? [])
        .map((s: any) => s.placePrediction)
        .filter(Boolean)
        .map((p: any) => ({
            placeId: p.placeId,
            mainText: p.structuredFormat?.mainText?.text ?? '',
            secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        }))

    return NextResponse.json({ predictions })
}
