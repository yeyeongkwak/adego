'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Star } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/PageHeader'
import { StopRow } from '@/components/StopRow'
import { useFavoritePlaces } from '@/hooks/useFavoritePlaces'
import { useFavoriteStops } from '@/hooks/useFavoriteStops'
import { useRouteSearchStore } from '@/store/routeSearchStore'
import { useStopSelectStore } from '@/store/stopSelectStore'
import type { NearbyStop, SelectedPlace } from '@/types/common'

function PlaceRow({
    place,
    onSelect,
    onRemove,
}: {
    place: SelectedPlace
    onSelect: () => void
    onRemove: () => void
}) {
    return (
        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm transition-colors hover:bg-gray-50">
            <button
                type="button"
                onClick={onSelect}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    <MapPin className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900">
                        {place.label}
                    </span>
                    {place.address && (
                        <span className="block truncate text-xs text-gray-500">
                            {place.address}
                        </span>
                    )}
                </span>
            </button>
            <button
                type="button"
                onClick={onRemove}
                aria-label="Remove from favourites"
                className="shrink-0 p-1 text-amber-400 transition-colors hover:text-amber-500"
            >
                <Star className="size-4 fill-amber-400" />
            </button>
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Star className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">{text}</p>
        </div>
    )
}

export default function FavoritePage() {
    const router = useRouter()
    const { favorites: favoritePlaces, toggleFavorite: toggleFavoritePlace } =
        useFavoritePlaces()
    const { favorites: favoriteStops, toggleFavorite: toggleFavoriteStop } =
        useFavoriteStops()

    const [resolvingPlace, setResolvingPlace] = useState(false)

    // Same "current location as origin" flow as Home's "Where to?" ->
    // destination pick (see app/(main)/home/page.tsx handleDestinationPicked).
    const handlePlaceSelect = (destination: SelectedPlace) => {
        setResolvingPlace(true)
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude
                const lng = position.coords.longitude
                let label = 'Current Location'
                try {
                    const res = await fetch(
                        `/api/reverse-geocode?lat=${lat}&lng=${lng}`
                    )
                    const data = await res.json()
                    if (data.address) label = data.address
                } catch {}

                useRouteSearchStore
                    .getState()
                    .setPendingSearch({ label, lat, lng }, destination)
                router.push('/route')
            },
            () => {
                setResolvingPlace(false)
                alert(
                    'Could not get your current location. Please allow location access and try again.'
                )
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
    }

    const handleStopSelect = (stop: NearbyStop) => {
        useStopSelectStore.getState().setPendingStop(stop)
        router.push('/stops')
    }

    return (
        <div className="flex h-full flex-col bg-gray-50">
            <div className="bg-[#002D62] px-4 py-4 text-white shadow-md">
                <PageHeader title="Favourites" />
            </div>

            <Tabs
                defaultValue="places"
                className="flex flex-1 flex-col min-h-0"
            >
                <div className="shrink-0 border-b bg-white px-4 pt-3 pb-3">
                    <TabsList className="w-full">
                        <TabsTrigger value="places">Places</TabsTrigger>
                        <TabsTrigger value="stops">Stops</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent
                    value="places"
                    className="flex flex-1 flex-col overflow-y-auto p-4"
                >
                    {resolvingPlace ? (
                        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
                            Getting your location…
                        </div>
                    ) : favoritePlaces.length > 0 ? (
                        <div className="space-y-2">
                            {favoritePlaces.map((place) => (
                                <PlaceRow
                                    key={place.placeId ?? place.label}
                                    place={place}
                                    onSelect={() => handlePlaceSelect(place)}
                                    onRemove={() => toggleFavoritePlace(place)}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState text="No favourite places yet. Star a place from the search screen to save it here." />
                    )}
                </TabsContent>

                <TabsContent
                    value="stops"
                    className="flex flex-1 flex-col overflow-y-auto p-4"
                >
                    {favoriteStops.length > 0 ? (
                        <div className="space-y-2">
                            {favoriteStops.map((stop) => (
                                <StopRow
                                    key={stop.id}
                                    stop={stop}
                                    isFavorite
                                    onSelect={() => handleStopSelect(stop)}
                                    onToggleFavorite={() =>
                                        toggleFavoriteStop(stop)
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState text="No favourite stops yet. Star a stop from the Stops tab to save it here." />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
