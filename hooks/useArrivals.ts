// Fetches realtime arrivals for the routes currently on screen.
// Refreshes every 30s so the countdown stays honest.

'use client'

import { useQuery } from '@tanstack/react-query'
import { Arrival, ILeg, IRouteOption } from '@/types/common'

type ArrivalTime = Omit<Arrival, 'stopName' | 'routeName'>
type ArrivalGroup = {
    stopName: string
    routeName: string
    times: ArrivalTime[]
}

function pairKey(stopName?: string, routeName?: string) {
    return `${stopName ?? ''}|${routeName ?? ''}`
}

export function useArrivals(options: IRouteOption[]) {
    // Every TRANSIT leg across every option, grouped by (stop, route) — this
    // is one-to-many, not a lookup: several options can board the exact
    // same bus at the same stop (e.g. "leave now" vs. "leave a bit later"
    // both riding the 174), and each of those legs needs matching to a
    // *different* upcoming arrival, not the same one.
    const legsByPair = new Map<string, ILeg[]>()
    for (const option of options) {
        for (const leg of option.legs) {
            if (
                leg.mode !== 'TRANSIT' ||
                !leg.departureStopName ||
                !leg.routeName
            )
                continue
            const key = pairKey(leg.departureStopName, leg.routeName)
            const list = legsByPair.get(key)
            if (list) list.push(leg)
            else legsByPair.set(key, [leg])
        }
    }

    const uniquePairs = Array.from(legsByPair.keys()).map((key) => {
        const [stop, route] = key.split('|')
        return { stop, route }
    })

    const query = useQuery({
        queryKey: ['arrivals', Array.from(legsByPair.keys()).sort()],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({
                stops: uniquePairs.map((p) => p.stop).join(','),
                routes: uniquePairs.map((p) => p.route).join(','),
            })
            const res = await fetch(`/api/arrivals?${params}`, { signal })
            if (!res.ok) throw new Error('Failed to load arrivals')
            const data = await res.json()
            return (data.arrivals ?? []) as ArrivalGroup[]
        },
        enabled: uniquePairs.length > 0,
        // The feed updates ~every 60s; poll a bit faster so the countdown doesn't drift too far.
        refetchInterval: 30_000,
        staleTime: 15_000,
        retry: 1,
    })

    const groupByKey = new Map(
        (query.data ?? []).map((g) => [pairKey(g.stopName, g.routeName), g])
    )
    const arrivals = new Map<ILeg, Arrival>()
    for (const [key, legs] of legsByPair) {
        const times = groupByKey.get(key)?.times ?? []
        const ranked = [...legs].sort(
            (a, b) => (a.departureValue ?? 0) - (b.departureValue ?? 0)
        )
        ranked.forEach((leg, i) => {
            const t = times[i]
            arrivals.set(leg, {
                stopName: leg.departureStopName!,
                routeName: leg.routeName!,
                minutesUntil: t?.minutesUntil ?? null,
                delaySeconds: t?.delaySeconds ?? null,
                isRealtime: t?.isRealtime ?? false,
                tripId: t?.tripId ?? null,
            })
        })
    }

    return { arrivals, loading: query.isLoading }
}
