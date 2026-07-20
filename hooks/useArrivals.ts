// Fetches realtime arrivals for the routes currently on screen.
// Refreshes every 30s so the countdown stays honest.

'use client'

import { useQuery } from '@tanstack/react-query'
import { Arrival, IRouteOption } from '@/types/common'

// Key for looking an arrival back up: "stopName|routeName"
export function arrivalKey(stopName?: string, routeName?: string) {
    return `${stopName ?? ''}|${routeName ?? ''}`
}

export function useArrivals(options: IRouteOption[]) {
    // Collect every (stop, route) pair across every transit leg — not just the
    // first one — so transfers get realtime + live tracking too, not only
    // the vehicle you board first.
    const pairs = options
        .flatMap((o) => o.legs)
        .filter(
            (l): l is NonNullable<typeof l> & { mode: 'TRANSIT' } =>
                l.mode === 'TRANSIT' && !!l.departureStopName && !!l.routeName
        )
        .map((l) => ({ stop: l.departureStopName!, route: l.routeName! }))

    // Dedupe — several options may board the same bus at the same stop.
    const unique = Array.from(
        new Map(pairs.map((p) => [`${p.stop}|${p.route}`, p])).values()
    )

    const query = useQuery({
        queryKey: [
            'arrivals',
            unique.map((p) => `${p.stop}|${p.route}`).sort(),
        ],
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({
                stops: unique.map((p) => p.stop).join(','),
                routes: unique.map((p) => p.route).join(','),
            })
            const res = await fetch(`/api/arrivals?${params}`, { signal })
            if (!res.ok) throw new Error('Failed to load arrivals')
            const data = await res.json()
            return (data.arrivals ?? []) as Arrival[]
        },
        enabled: unique.length > 0,
        // The feed updates ~every 60s; poll a bit faster so the countdown
        // doesn't drift too far.
        refetchInterval: 30_000,
        staleTime: 15_000,
        retry: 1,
    })

    // Map for O(1) lookup from a card: arrivals.get(arrivalKey(stop, route))
    const arrivals = new Map<string, Arrival>(
        (query.data ?? []).map((a) => [arrivalKey(a.stopName, a.routeName), a])
    )

    return { arrivals, loading: query.isLoading }
}
