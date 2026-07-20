import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { IRouteOption } from '@/types/common'

const toLeg = (step: any) => {
    if (step.travel_mode === 'WALKING') {
        return {
            mode: 'WALKING',
            durationText: step.duration.text,
            durationSec: step.duration.value,
        }
    }

    const td = step.transit_details ?? {}
    return {
        mode: 'TRANSIT',
        durationText: step.duration.text,
        durationSec: step.duration.value,
        routeName: td?.short_name ?? td.line?.name,
        vehicleTYpe: td.line?.vehicle?.type,
        departureStopName: td.departure_stop?.name,
        arrivalStopName: td.arrival_stop?.name,
        numStops: td.num_stops,
    }
}

const fetchRouteColors = async (
    routeNames: string[]
): Promise<Map<string, string>> => {
    const map = new Map<string, string>()
    if (routeNames.length === 0) return map

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!url || !key) return map

    const supabase = createClient(url, key, { auth: { persistSession: false } })

    const { data, error } = await supabase
        .from('gtfs_routes')
        .select('route_id, route_short_name, route_color')
        .or(
            `route_short_name.in.(${routeNames.join(',')}), route_id.in.(${routeNames.join(',')}`
        )

    if (error || !data) return map
    for (const row of data as any[]) {
        if (!row.route_color) continue
        if (row.route_short_name) map.set(row.route_short_name, row.route_color)
        if (row.route_id) map.set(row.route_id, row.route_color)
    }
    return map
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const origin = searchParams.get('origin')
    const destination = searchParams.get('destination')
    const departureTime = searchParams.get('departureTime') || 'now'

    if (!origin || !destination) {
        return NextResponse.json(
            {
                error: 'Both origin and destination require langtitude and longitude',
            },
            { status: 400 }
        )
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY_NO_REFERRER
    if (!apiKey) {
        return NextResponse.json(
            { error: '서버에 GOOGLE_MAPS_API_KEY 가 없습니다.' },
            { status: 500 }
        )
    }

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
    url.searchParams.set('origin', origin)
    url.searchParams.set('destination', destination)
    url.searchParams.set('mode', 'transit') // 버스/트램/기차 자동 비교
    url.searchParams.set('alternatives', 'true') // 여러 경로 옵션 (네 목업의 카드 여러 개)
    url.searchParams.set('departure_time', departureTime)
    url.searchParams.set('region', 'au') // 애들레이드(호주) 편향
    url.searchParams.set('key', apiKey)

    let data: any
    try {
        const res = await fetch(url.toString())
        data = await res.json()
    } catch {
        return NextResponse.json(
            { error: '구글 요청 실패(네트워크).' },
            { status: 502 }
        )
    }

    if (data.status !== 'OK') {
        // ZERO_RESULTS: 경로 없음 / REQUEST_DENIED: 키·billing 문제 / OVER_QUERY_LIMIT 등
        const code = data.status === 'ZERO_RESULTS' ? 404 : 502
        return NextResponse.json(
            {
                error: `Directions: ${data.status}`,
                detail: data.error_message ?? null,
            },
            { status: code }
        )
    }

    const options: IRouteOption[] = (data.routes ?? []).map((route: any) => {
        const leg = route.legs[0] // A→B 단일 구간 여정이라 legs[0]
        return {
            durationText: leg.duration.text,
            departureText: leg.departure_time?.text,
            departureValue: leg.departure_time?.value,
            arrivalText: leg.arrival_time?.text,
            legs: (leg.steps ?? []).map(toLeg),
        }
    })

    // Filter walking legs
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
                leg.routeColor = colorMap.get(leg.routeName)
            }
        }
    }

    return NextResponse.json({ options: transitOptions })
}
