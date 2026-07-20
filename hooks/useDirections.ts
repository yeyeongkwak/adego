// Automatically calls /api/directions when both origin and destination exist.

'use client'

import { IRouteOption, SelectedPlace, TimeOption } from '@/types/common'
import { useQuery } from '@tanstack/react-query'

const fetchDirections = async (
    origin: SelectedPlace,
    destination: SelectedPlace,
    timeOption: TimeOption,
    signal?: AbortSignal
): Promise<IRouteOption[]> => {
    const params = new URLSearchParams({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
    })

    if (timeOption?.mode === 'depart')
        params.set('departureTime', timeOption.time)
    if (timeOption?.mode === 'arrive')
        params.set('arrivalTime', timeOption.time)

    const res = await fetch(`/api/directions?${params}`, { signal })
    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            res.status === 404
                ? 'No public transport route found for this trip'
                : 'Failed to load the route'
        )
    }
    return data.options ?? []
}

export function useDirections(
    origin: SelectedPlace | null,
    destination: SelectedPlace | null,
    timeOption: TimeOption
) {
    const query = useQuery({
        queryKey: [
            'directions',
            origin?.lat,
            origin?.lng,
            destination?.lat,
            destination?.lng,
            timeOption?.mode,
            timeOption?.time,
        ],
        queryFn: ({ signal }) =>
            fetchDirections(origin!, destination!, timeOption, signal),
        enabled: !!origin && !!destination,
        refetchInterval: timeOption?.time === 'now' ? 60_000 : false,
        refetchOnWindowFocus: true,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
    })

    return {
        options: query.data ?? [],
        loading: query.isLoading,
        refreshing: !query.isLoading && query.isFetching,
        error: query.error ? (query.error as Error).message : null,
        refetch: query.refetch,
    }
}
