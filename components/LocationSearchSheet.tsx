import { useState } from 'react'
import {
    X,
    Search,
    Navigation,
    Map,
    User,
    MapPin,
    Star,
    Clock,
    ChevronRight,
    Lock,
    Loader2,
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
import { Prediction, SelectedPlace } from '@/types/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface LocationSearchSheetProps {
    isOpen: boolean
    onClose: () => void
    title: string
    isAuthenticated: boolean
    onLocationSelect: (place: SelectedPlace) => void
    onLoginClick: () => void
}

interface FavoriteLocation {
    id: string
    name: string
    label: string
    address: string
    icon: 'home' | 'work' | 'location'
    longitude: number
    latitude: number
}

interface RecentLocation {
    id: string
    name: string
    address: string
    longitude: number
    latitude: number
}

export function LocationSearchSheet({
    isOpen,
    onClose,
    title,
    isAuthenticated,
    onLocationSelect,
    onLoginClick,
}: LocationSearchSheetProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [resolving, setResolving] = useState(false)

    // Only fire the autocomplete request once there's more than 1 character.
    const hasQuery = searchQuery.trim().length > 1
    const { predictions, loading } = useAutocomplete(
        hasQuery ? searchQuery : ''
    )

    const favoriteLocations: FavoriteLocation[] = [
        {
            id: '1',
            name: 'Home',
            label: '326 Gilles St',
            latitude: 0,
            longitude: 0,
            address: '326 Gilles St, Adelaide SA 5000',
            icon: 'home',
        },
        {
            id: '2',
            name: 'Woolworths',
            label: '80 Rundle Mall',
            latitude: 0,
            longitude: 0,
            address: '80 Rundle Mall, Adelaide SA 5000, Australia',
            icon: 'location',
        },
        {
            id: '3',
            name: 'Flinders University City Campus',
            label: '3 Station Rd',
            latitude: 0,
            longitude: 0,
            address: '3 Station Rd, Adelaide SA 5000, Australia',
            icon: 'location',
        },
    ]

    const recentLocations: RecentLocation[] = [
        {
            id: '1',
            name: 'Bottega Gelateria',
            address: '58 Jetty Rd, Glenelg SA 5045, Australia',
            latitude: 0,
            longitude: 0,
        },
        {
            id: '2',
            name: 'Victoria Square Stop',
            address: 'Adelaide SA 5000, Australia',
            latitude: 0,
            longitude: 0,
        },
        {
            id: '3',
            name: 'Adelaide Railway Station',
            address: 'North Tce, Adelaide SA 5000, Australia',
            latitude: 0,
            longitude: 0,
        },
    ]

    const handleCurrentLocationClick = async () => {
        // 1) Check permission status
        const status = await navigator.permissions.query({
            name: 'geolocation',
        })

        if (status.state === 'denied') {
            // Already denied => Show alert
            alert('Geolocation is denied. Please allow in the browser settings')
            return
        }

        // 2) Granted(already allowed) or Prompt(non-decided) => Call getCurrentPosition
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude
                const lng = position.coords.longitude

                // Reverse-Geocode
                let address = 'Current Location'
                try {
                    const res = await fetch(
                        `/api/reverse-geocode?lat=${lat}&lng=${lng}`
                    )
                    const data = await res.json()
                    if (data.address) address = data.address
                } catch (e) {}
                onLocationSelect({
                    label: address,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                })
            },
            () => alert('Failed to get current location'),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
    }

    const handlePick = async (prediction: Prediction) => {
        setResolving(true)
        try {
            const res = await fetch(
                `/api/place-coords?placeId=${encodeURIComponent(prediction.placeId)}`
            )
            const data = await res.json()
            if (data.lat != null && data.lng != null) {
                onLocationSelect({
                    label: prediction.mainText,
                    address: prediction.secondaryText || data.address,
                    lat: data.lat,
                    lng: data.lng,
                })
            }
        } finally {
            setResolving(false)
            setSearchQuery('')
        }
    }

    return (
        <Sheet
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
        >
            <SheetContent
                side="bottom"
                showCloseButton={false}
                // 모바일 앱 셸(max-w-md)과 폭을 맞춘다 — Sheet도 body에 포탈되므로
                // (Footer/HomeSheet과 같은 이유) 여기서 직접 제약해야 함.
                className="inset-0 mx-auto h-full w-full max-w-md gap-0 rounded-none border-0 bg-white p-0 flex flex-col"
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
                                onChange={(e) => setSearchQuery(e.target.value)}
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
                                    <Button
                                        key={prediction.placeId}
                                        variant="ghost"
                                        className="h-auto w-full justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                        onClick={() => handlePick(prediction)}
                                    >
                                        <div className="p-2 bg-gray-100 rounded-full">
                                            <MapPin className="size-5 text-gray-600" />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="font-medium truncate">
                                                {prediction.mainText}
                                            </p>
                                            <p className="text-sm text-gray-500 truncate">
                                                {prediction.secondaryText}
                                            </p>
                                        </div>
                                    </Button>
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
                                            style={{ color: 'var(--primary)' }}
                                        />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-medium">
                                            Current Location
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            240 Hutt St
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

                            {/* Favorites - Only for authenticated users */}
                            {isAuthenticated ? (
                                <div className="px-4 py-1">
                                    <h3 className="font-semibold mb-3">
                                        Favorites
                                    </h3>
                                    <div className="space-y-2">
                                        {favoriteLocations.map((location) => (
                                            <Button
                                                key={location.id}
                                                variant="ghost"
                                                className="h-auto w-full justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                                onClick={() =>
                                                    onLocationSelect({
                                                        label: location.label,
                                                        lat: location.latitude,
                                                        lng: location.longitude,
                                                    })
                                                }
                                            >
                                                <div className="p-2 bg-gray-100 rounded-full">
                                                    {location.icon ===
                                                    'home' ? (
                                                        <Star className="size-5 text-gray-600 fill-gray-600" />
                                                    ) : (
                                                        <MapPin className="size-5 text-gray-600" />
                                                    )}
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="font-medium">
                                                        {location.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {location.address}
                                                    </p>
                                                </div>
                                                <ChevronRight className="size-5 text-gray-400" />
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="px-4 py-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-gray-400">
                                            Favorites
                                        </h3>
                                        <Lock className="size-4 text-gray-400" />
                                    </div>
                                    <Card className="p-6 bg-linear-to-r from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 bg-gray-200 rounded-full">
                                                <Star className="size-6 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-700 mb-1">
                                                    Save Your Favorites
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Sign in to access saved
                                                    locations
                                                </p>
                                            </div>
                                            <Button
                                                onClick={onLoginClick}
                                                variant="outline"
                                                className="mt-2"
                                            >
                                                Sign In
                                            </Button>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* Recent - Only for authenticated users */}
                            {isAuthenticated ? (
                                <div className="px-4 py-1 mt-6">
                                    <h3 className="font-semibold mb-3">
                                        Recent
                                    </h3>
                                    <div className="space-y-2">
                                        {recentLocations.map((location) => (
                                            <Button
                                                key={location.id}
                                                variant="ghost"
                                                className="h-auto w-full justify-start gap-4 rounded-lg p-4 hover:bg-gray-50 hover:text-foreground"
                                                onClick={() =>
                                                    onLocationSelect({
                                                        label: location.name,
                                                        lat: location.latitude,
                                                        lng: location.longitude,
                                                    })
                                                }
                                            >
                                                <div className="p-2 bg-gray-100 rounded-full">
                                                    <Clock className="size-5 text-gray-600" />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="font-medium">
                                                        {location.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {location.address}
                                                    </p>
                                                </div>
                                                <ChevronRight className="size-5 text-gray-400" />
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="px-4 py-2 mt-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-gray-400">
                                            Recent
                                        </h3>
                                        <Lock className="size-4 text-gray-400" />
                                    </div>
                                    <Card className="p-6 bg-linear-to-r from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 bg-gray-200 rounded-full">
                                                <Clock className="size-6 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-700 mb-1">
                                                    View Your History
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Sign in to see recent
                                                    searches
                                                </p>
                                            </div>
                                            <Button
                                                onClick={onLoginClick}
                                                variant="outline"
                                                className="mt-2"
                                            >
                                                Sign In
                                            </Button>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
