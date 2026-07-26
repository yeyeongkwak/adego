// Next few buses (any route) at a single stop — powers the map popup.
// Only fetches while a stopId is actually given (i.e. a stop is selected),
// and polls every 30s like useArrivals so the ETA stays honest.

'use client'

import { useQuery } from '@tanstack/react-query'
import type { StopArrival } from '@/types/common'

type StopArrivalsResult = {
    arrivals: StopArrival[]
    hasMore: boolean
}

export function useStopArrivals(stopId: string | null, withinMinutes?: number) {
    const { data, isLoading } = useQuery({
        queryKey: ['stops-arrivals', stopId, withinMinutes],
        queryFn: async ({ signal }): Promise<StopArrivalsResult> => {
            const params = new URLSearchParams({ stopId: stopId! })
            if (withinMinutes != null) {
                params.set('withinMinutes', String(withinMinutes))
            }
            const res = await fetch(`/api/stops-arrivals?${params}`, {
                signal,
            })
            if (!res.ok) throw new Error('Failed to load arrivals')
            const data = await res.json()
            return { arrivals: data.arrivals ?? [], hasMore: !!data.hasMore }
        },
        enabled: !!stopId,
        refetchInterval: 30_000,
        staleTime: 15_000,
        retry: 1,
    })

    return {
        arrivals: data?.arrivals ?? [],
        hasMore: data?.hasMore ?? false,
        loading: isLoading,
    }
}
