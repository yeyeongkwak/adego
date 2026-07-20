// Retrieves stops near the current coordinates from /api/stops-nearby.
// Rounds coordinates to 4 digits to stabilize the query key (prevents re-requests due to GPS vibrations).

'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { NearbyStop } from '@/types/common'

export function useNearbyStops(
    center: { lat: number; lng: number } | null,
    radius = 600
) {
    const lat = center ? Math.round(center.lat * 10000) / 10000 : null
    const lng = center ? Math.round(center.lng * 10000) / 10000 : null

    const query = useQuery({
        queryKey: ['stops-nearby', lat, lng, radius],
        queryFn: async ({ signal }): Promise<NearbyStop[]> => {
            const res = await fetch(
                `/api/stops-nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
                { signal }
            )
            const data = await res.json()
            if (!res.ok)
                throw new Error(data.error ?? 'Failed to load nearby stops')
            return data.stops ?? []
        },
        enabled: lat != null && lng != null,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        // Panning re-keys this query (new rounded center) — without this,
        // `stops` briefly goes empty between the pan settling and the new
        // fetch resolving, which was enough to trip HomeMap's "selected
        // stop vanished from the list -> close its bubble" cleanup.
        placeholderData: keepPreviousData,
    })

    return {
        stops: query.data ?? [],
        loading: query.isLoading,
        error: query.error ? (query.error as Error).message : null,
    }
}
