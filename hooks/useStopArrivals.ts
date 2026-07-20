// Next few buses (any route) at a single stop — powers the map popup.
// Only fetches while a stopId is actually given (i.e. a stop is selected),
// and polls every 30s like useArrivals so the ETA stays honest.

'use client'

import { useQuery } from '@tanstack/react-query'
import type { StopArrival } from '@/types/common'

export function useStopArrivals(stopId: string | null) {
    const query = useQuery({
        queryKey: ['stops-arrivals', stopId],
        queryFn: async ({ signal }): Promise<StopArrival[]> => {
            const res = await fetch(
                `/api/stops-arrivals?stopId=${encodeURIComponent(stopId!)}`,
                { signal }
            )
            if (!res.ok) throw new Error('Failed to load arrivals')
            const data = await res.json()
            return data.arrivals ?? []
        },
        enabled: !!stopId,
        refetchInterval: 30_000,
        staleTime: 15_000,
        retry: 1,
    })

    return {
        arrivals: query.data ?? [],
        loading: query.isLoading,
    }
}
