// Full route shape (static GTFS geometry) for one trip — the line the
// vehicle drives end to end.
// Static data

'use client'

import { useQuery } from '@tanstack/react-query'

export type RouteShapePoint = { lat: number; lng: number }

export function useRouteShape(tripId: string | null) {
    const query = useQuery({
        queryKey: ['route-shape', tripId],
        queryFn: async ({ signal }): Promise<RouteShapePoint[]> => {
            const res = await fetch(
                `/api/route-shape?tripId=${encodeURIComponent(tripId!)}`,
                { signal }
            )
            if (res.status === 404) return []
            if (!res.ok) throw new Error('Failed to load route shape')
            const { path } = await res.json()
            return path as RouteShapePoint[]
        },
        enabled: !!tripId,
        staleTime: Infinity, // static per trip, never changes underneath us
        retry: 1,
    })

    return {
        path: query.data ?? null,
        loading: query.isLoading,
    }
}
