import { useState } from 'react'
import {
    X,
    Search,
    Navigation,
    Map,
    MapPin,
    Star,
    Clock,
    ChevronRight,
    Loader2,
    LocateFixed,
} from 'lucide-react'
import { Input } from './ui/input'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from './ui/sheet'
import { useAutocomplete } from '@/hooks/useAutocomplete'
import { useFavoritePlaces } from '@/hooks/useFavoritePlaces'
import { useRecentPlaces } from '@/hooks/useRecentPlaces'
import { useGeolocationStore } from '@/store/geolocationStore'
import { Prediction, SelectedPlace } from '@/types/common'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/utils'

interface LocationSearchSheetProps {
    isOpen: boolean
    onClose: () => void
    title: string
    onLocationSelect: (place: SelectedPlace) => void
}

export function LocationSearchSheet({
    isOpen,
    onClose,
    title,
    onLocationSelect,
}: LocationSearchSheetProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [resolving, setResolving] = useState(false)
    const [favoritingPlaceId, setFavoritingPlaceId] = useState<string | null>(
        null
    )

    const [locationPromptOpen, setLocationPromptOpen] = useState(false)
    const coords = useGeolocationStore((s) => s.coords)
    const locating = useGeolocationStore((s) => s.locating)
    const enableLocation = useGeolocationStore((s) => s.enable)

    // Only fire the autocomplete request once there's more than 1 character.
    const hasQuery = searchQuery.trim().length > 1
    const { predictions, loading, sessionToken, endSession } = useAutocomplete(
        hasQuery ? searchQuery : ''
    )

    const { favorites, toggleFavorite } = useFavoritePlaces()
    const { recents, addRecent } = useRecentPlaces()

    const handleSelect = (place: SelectedPlace) => {
        addRecent(place)
        onLocationSelect(place)
    }

    const selectCoords = async (lat: number, lng: number) => {
        // Same reverse-geocode used elsewhere -> "Current Location" resolves
        // to an actual address, not the literal string.
        let address = 'Current Location'
        try {
            const res = await fetch(
                `/api/reverse-geocode?lat=${lat}&lng=${lng}`
            )
            const data = await res.json()
            if (data.address) address = data.address
        } catch {}
        onLocationSelect({ label: address, lat, lng })
    }

    const handleCurrentLocationClick = async () => {
        // Already watching (granted earlier, maybe even on a different page)
        // -> reuse the live fix instead of asking again.
        if (coords) {
            await selectCoords(coords.lat, coords.lng)
            return
        }
        setLocationPromptOpen(true)
    }

    const handleEnableLocationConfirm = async () => {
        const ok = await enableLocation()
        setLocationPromptOpen(false)
        if (!ok) {
            alert('Failed to get current location')
            return
        }
        const fresh = useGeolocationStore.getState().coords
        if (fresh) await selectCoords(fresh.lat, fresh.lng)
    }

    const handlePick = async (prediction: Prediction) => {
        setResolving(true)
        try {
            const params = new URLSearchParams({ placeId: prediction.placeId })
            if (sessionToken) params.set('sessionToken', sessionToken)

            const res = await fetch(`/api/place-coords?${params.toString()}`)
            const data = await res.json()
            if (data.lat != null && data.lng != null) {
                handleSelect({
                    label: prediction.mainText,
                    address: data.address || prediction.secondaryText,
                    lat: data.lat,
                    lng: data.lng,
                    placeId: prediction.placeId,
                })
            }
        } finally {
            endSession()
            setResolving(false)
            setSearchQuery('')
        }
    }

    const handleToggleFavoritePrediction = async (
        e: React.MouseEvent,
        prediction: Prediction
    ) => {
        e.stopPropagation()

        if (favorites.some((f) => f.placeId === prediction.placeId)) {
            toggleFavorite({
                label: prediction.mainText,
                lat: 0,
                lng: 0,
                placeId: prediction.placeId,
            })
            return
        }

        setFavoritingPlaceId(prediction.placeId)
        try {
            const params = new URLSearchParams({
                placeId: prediction.placeId,
            })
            if (sessionToken) params.set('sessionToken', sessionToken)

            const res = await fetch(`/api/place-coords?${params.toString()}`)
            const data = await res.json()
            if (data.lat != null && data.lng != null) {
                toggleFavorite({
                    label: prediction.mainText,
                    address: data.address || prediction.secondaryText,
                    lat: data.lat,
                    lng: data.lng,
                    placeId: prediction.placeId,
                })
            }
        } finally {
            setFavoritingPlaceId(null)
        }
    }

    return (
        <>
            <Sheet
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) onClose()
                }}
                modal={false}
            >
                <SheetContent
                    side="bottom"
                    showCloseButton={false}
                    className="inset-0 z-[70] mx-auto h-full w-full max-w-md gap-0 rounded-none border-0 bg-white p-0 flex flex-col"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>{title}</SheetTitle>
                        <SheetDescription>
                            Search and select a location
                        </SheetDescription>
                    </SheetHeader>
                    {/* Header */}
                    <div className="shrink-0 bg-white border-b px-4 py-3">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 pointer-events-none z-10" />
                                <Input
                                    type="text"
                                    placeholder={title}
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className="h-12 rounded-lg border-0 bg-gray-50 pl-10 pr-10 shadow-none transition-all focus-visible:border-transparent focus-visible:ring-0 focus:bg-white focus:text-primary focus:ring-2"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 z-10 size-auto -translate-y-1/2 rounded-full p-1.5 hover:bg-gray-200 hover:text-foreground"
                                    >
                                        <X className="size-4 text-gray-500" />
                                    </Button>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="size-auto shrink-0 rounded-full p-2 hover:bg-gray-100 hover:text-foreground"
                            >
                                <X className="size-6 text-gray-700" />
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto pb-8 scrollbar-thin">
                        {hasQuery ? (
                            <div className="p-4 space-y-1">
                                {(loading || resolving) && (
                                    <div className="flex items-center gap-2 p-4 text-sm text-gray-500">
                                        <Loader2 className="size-4 animate-spin" />
                                        {resolving
                                            ? 'Getting location…'
                                            : 'Searching…'}
                                    </div>
                                )}

                                {!loading &&
                                    !resolving &&
                                    predictions.length === 0 && (
                                        <p className="p-4 text-sm text-gray-500">
                                            No results.
                                        </p>
                                    )}

                                {!resolving &&
                                    predictions.map((prediction) => (
                                        <div
                                            key={prediction.placeId}
                                            className="flex items-center gap-1"
                                        >
                                            <Button
                                                variant="ghost"
                                                className="h-auto min-w-0 flex-1 justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                                onClick={() =>
                                                    handlePick(prediction)
                                                }
                                            >
                                                <div className="p-2 bg-gray-100 rounded-full">
                                                    <MapPin className="size-5 text-gray-600" />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="font-medium truncate">
                                                        {prediction.mainText}
                                                    </p>
                                                    <p className="text-sm text-gray-500 truncate">
                                                        {
                                                            prediction.secondaryText
                                                        }
                                                    </p>
                                                </div>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) =>
                                                    handleToggleFavoritePrediction(
                                                        e,
                                                        prediction
                                                    )
                                                }
                                                disabled={
                                                    favoritingPlaceId ===
                                                    prediction.placeId
                                                }
                                                aria-label={
                                                    favorites.some(
                                                        (f) =>
                                                            f.placeId ===
                                                            prediction.placeId
                                                    )
                                                        ? 'Remove from favourites'
                                                        : 'Add to favourites'
                                                }
                                                className="shrink-0 text-gray-300 hover:bg-transparent hover:text-amber-400"
                                            >
                                                {favoritingPlaceId ===
                                                prediction.placeId ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Star
                                                        className={cn(
                                                            'size-4',
                                                            favorites.some(
                                                                (f) =>
                                                                    f.placeId ===
                                                                    prediction.placeId
                                                            ) &&
                                                                'fill-amber-400 text-amber-400'
                                                        )}
                                                    />
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <>
                                {/* Quick Actions */}
                                <div className="p-4 space-y-2">
                                    <Button
                                        variant="ghost"
                                        className="h-auto w-full justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                        onClick={handleCurrentLocationClick}
                                    >
                                        <div className="p-2 bg-blue-50 rounded-full">
                                            <Navigation
                                                className="size-5"
                                                style={{
                                                    color: 'var(--primary)',
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium">
                                                Current Location
                                            </p>
                                        </div>
                                        <ChevronRight className="size-5 text-gray-400" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        className="h-auto w-full justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                        onClick={() => {}}
                                    >
                                        <div className="p-2 bg-gray-100 rounded-full">
                                            <Map className="size-5 text-gray-600" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium">
                                                Choose on map...
                                            </p>
                                        </div>
                                        <ChevronRight className="size-5 text-gray-400" />
                                    </Button>
                                </div>

                                {/* Favorites — localStorage-backed, works for
                                guests too (see useFavoritePlaces) */}
                                {favorites.length > 0 && (
                                    <div className="px-4 py-1">
                                        <h3 className="font-semibold mb-3">
                                            Favorites
                                        </h3>
                                        <div className="space-y-2">
                                            {favorites.map((place) => (
                                                <div
                                                    key={
                                                        place.placeId ??
                                                        place.label
                                                    }
                                                    className="flex items-center gap-1"
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        className="h-auto min-w-0 flex-1 justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                                        onClick={() =>
                                                            handleSelect(place)
                                                        }
                                                    >
                                                        <div className="p-2 bg-gray-100 rounded-full">
                                                            <Star className="size-5 fill-amber-400 text-amber-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 text-left">
                                                            <p className="font-medium truncate">
                                                                {place.label}
                                                            </p>
                                                            {place.address && (
                                                                <p className="text-sm text-gray-500 truncate">
                                                                    {
                                                                        place.address
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            toggleFavorite(
                                                                place
                                                            )
                                                        }
                                                        aria-label="Remove from favourites"
                                                        className="shrink-0 text-amber-400 hover:bg-transparent hover:text-amber-500"
                                                    >
                                                        <Star className="size-4 fill-amber-400" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {recents.length > 0 && (
                                    <div className="px-4 py-1 mt-6">
                                        <h3 className="font-semibold mb-3">
                                            Recent
                                        </h3>
                                        <div className="space-y-2">
                                            {recents.map((place) => (
                                                <Button
                                                    key={
                                                        place.placeId ??
                                                        place.label
                                                    }
                                                    variant="ghost"
                                                    className="h-auto w-full justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                                    onClick={() =>
                                                        handleSelect(place)
                                                    }
                                                >
                                                    <div className="p-2 bg-gray-100 rounded-full">
                                                        <Clock className="size-5 text-gray-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <p className="font-medium truncate">
                                                            {place.label}
                                                        </p>
                                                        {place.address && (
                                                            <p className="text-sm text-gray-500 truncate">
                                                                {place.address}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="size-5 text-gray-400" />
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {locationPromptOpen && (
                <div
                    className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Enable location"
                    onClick={() => setLocationPromptOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-t-2xl bg-white p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="rounded-full bg-blue-50 p-3">
                                <LocateFixed
                                    className="size-6"
                                    style={{ color: 'var(--primary)' }}
                                />
                            </div>
                            <p className="font-semibold">Location is off</p>
                            <p className="text-sm text-gray-500">
                                Turn on location access to use &quot;Current
                                Location&quot; as your starting point.
                            </p>
                            <Button
                                className="w-full rounded-full"
                                onClick={handleEnableLocationConfirm}
                                disabled={locating}
                            >
                                {locating ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    'Enable'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
