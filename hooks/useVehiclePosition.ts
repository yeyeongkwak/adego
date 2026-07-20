// Live GPS fix for one vehicle. Only fetches while a tripId is actually
// given (i.e. the "where's my bus" sheet is open), and polls fast since a
// bus's position goes stale in seconds, not minutes like arrival ETAs.

'use client'

import { useQuery } from '@tanstack/react-query'
import type { VehiclePosition } from '@/types/common'

export function useVehiclePosition(tripId: string | null) {
    const query = useQuery({
        queryKey: ['vehicle-position', tripId],
        queryFn: async ({ signal }): Promise<VehiclePosition | null> => {
            const res = await fetch(
                `/api/vehicle-position?tripId=${encodeURIComponent(tripId!)}`,
                { signal }
            )
            if (res.status === 404) return null
            if (!res.ok) throw new Error('Failed to load vehicle position')
            return res.json()
        },
        enabled: !!tripId,
        refetchInterval: 10_000,
        staleTime: 5_000,
        retry: 1,
    })

    return {
        position: query.data ?? null,
        loading: query.isLoading,
    }
}
