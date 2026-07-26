import { NextRequest, NextResponse } from 'next/server'
import { IRouteOption } from '@/types/common'
import { createPublicClient } from '@/util/supabase/public'
import { decodePolyline } from '@/util/map/decodePolyline'
import { formatDurationText } from '@/util/time/duration'

const ADELAIDE_TZ = 'Australia/Adelaide'

// Routes API returns durations as protobuf Duration strings ("725s") instead
// of Google-hosted display text -> format them ourselves.
const formatDuration = (
    durationField?: string
): { text: string; sec: number } => {
    const sec = durationField ? Math.round(parseFloat(durationField)) : 0
    return { text: formatDurationText(sec), sec }
}

const formatTimeLabel = (iso?: string): string | undefined => {
    if (!iso) return undefined
    return new Intl.DateTimeFormat('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: ADELAIDE_TZ,
    }).format(new Date(iso))
}

const toLeg = (step: any) => {
    const { text, sec } = formatDuration(step.staticDuration)
    const path = step.polyline?.encodedPolyline
        ? decodePolyline(step.polyline.encodedPolyline)
        : []

    if (step.travelMode === 'WALK') {
        return { mode: 'WALKING', durationText: text, durationSec: sec, path }
    }

    const td = step.transitDetails ?? {}
    return {
        mode: 'TRANSIT',
        durationText: text,
        durationSec: sec,
        path,
        routeName: td.transitLine?.nameShort ?? td.transitLine?.name,
        routeColor: td.transitLine?.color, // fallback; overridden by gtfs_routes below when available
        vehicleType: td.transitLine?.vehicle?.type,
        departureStopName: td.stopDetails?.departureStop?.name,
        arrivalStopName: td.stopDetails?.arrivalStop?.name,
        numStops: td.stopCount,
    }
}

const fetchRouteColors = async (
    routeNames: string[]
): Promise<Map<string, string>> => {
    const map = new Map<string, string>()
    if (routeNames.length === 0) return map

    const supabase = createPublicClient()
    if (!supabase) return map

    const { data, error } = await supabase
        .from('gtfs_routes')
        .select('route_id, route_short_name, route_color')
        .or(
            `route_short_name.in.(${routeNames.join(',')}), route_id.in.(${routeNames.join(',')}`
        )

    if (error || !data) return map
    for (const row of data as any[]) {
        if (!row.route_color) continue
        const color = `#${row.route_color}`
        if (row.route_short_name) map.set(row.route_short_name, color)
        if (row.route_id) map.set(row.route_id, color)
    }
    return map
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const origin = searchParams.get('origin')
    const destination = searchParams.get('destination')
    const departureTime = searchParams.get('departureTime')
    const arrivalTime = searchParams.get('arrivalTime')

    if (!origin || !destination) {
        return NextResponse.json(
            {
                error: 'Both origin and destination require latitude and longitude',
            },
            { status: 400 }
        )
    }

    const [originLat, originLng] = origin.split(',').map(Number)
    const [destLat, destLng] = destination.split(',').map(Number)

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
        return NextResponse.json(
            { error: 'GOOGLE_MAPS_API_KEY is empty' },
            { status: 500 }
        )
    }

    const body: Record<string, unknown> = {
        origin: {
            location: { latLng: { latitude: originLat, longitude: originLng } },
        },
        destination: {
            location: { latLng: { latitude: destLat, longitude: destLng } },
        },
        travelMode: 'TRANSIT',
        computeAlternativeRoutes: true,
        regionCode: 'AU',
    }

    if (departureTime) body.departureTime = departureTime
    else if (arrivalTime) body.arrivalTime = arrivalTime

    let data: any
    try {
        const res = await fetch(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    // Only ask for the fields we render -> cheaper + smaller response.
                    'X-Goog-FieldMask':
                        'routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails,routes.legs.steps.polyline.encodedPolyline',
                },
                body: JSON.stringify(body),
            }
        )
        data = await res.json()

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: 'Directions failed',
                    detail: data?.error?.message ?? null,
                },
                { status: 502 }
            )
        }
    } catch {
        return NextResponse.json(
            { error: '구글 요청 실패(네트워크).' },
            { status: 502 }
        )
    }

    if (!data.routes?.length) {
        return NextResponse.json({ error: 'No route found.' }, { status: 404 })
    }

    const options: IRouteOption[] = data.routes.map((route: any) => {
        const leg = route.legs[0] // A→B 단일 구간 여정이라 legs[0]
        const stepsRaw = leg.steps ?? []
        const steps = stepsRaw.map(toLeg)
        const transitSteps = stepsRaw.filter((s: any) => s.transitDetails)
        const firstTransit = transitSteps[0]?.transitDetails
        const lastTransit =
            transitSteps[transitSteps.length - 1]?.transitDetails

        let finalWalkSec = 0
        for (
            let i = stepsRaw.length - 1;
            i >= 0 && stepsRaw[i].travelMode === 'WALK';
            i--
        ) {
            finalWalkSec += Math.round(
                parseFloat(stepsRaw[i].staticDuration ?? '0')
            )
        }
        const arrivalIso = lastTransit?.stopDetails?.arrivalTime
            ? new Date(
                  new Date(lastTransit.stopDetails.arrivalTime).getTime() +
                      finalWalkSec * 1000
              ).toISOString()
            : undefined

        return {
            durationText: formatDuration(route.duration).text,
            durationSec: formatDuration(route.duration).sec,
            departureText: formatTimeLabel(
                firstTransit?.stopDetails?.departureTime
            ),
            departureValue: firstTransit?.stopDetails?.departureTime
                ? Math.floor(
                      new Date(
                          firstTransit.stopDetails.departureTime
                      ).getTime() / 1000
                  )
                : undefined,
            arrivalText: formatTimeLabel(arrivalIso),
            path: route.polyline?.encodedPolyline
                ? decodePolyline(route.polyline.encodedPolyline)
                : [],
            legs: steps,
        }
    })

    // Filter walking-only options
    const transitOptions = options.filter((opt) =>
        opt.legs.some((l) => l.mode === 'TRANSIT')
    )

    const routeNames = [
        ...new Set(
            transitOptions
                .flatMap((o) => o.legs)
                .filter((l) => l.mode === 'TRANSIT' && l.routeName)
                .map((l) => l.routeName as string)
        ),
    ]

    const colorMap = await fetchRouteColors(routeNames)

    for (const opt of transitOptions) {
        for (const leg of opt.legs) {
            if (leg.mode === 'TRANSIT' && leg.routeName) {
                leg.routeColor = colorMap.get(leg.routeName) ?? leg.routeColor
            }
        }
    }

    return NextResponse.json({ options: transitOptions })
}
