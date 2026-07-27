'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LocateFixed, User } from 'lucide-react'
import { HomeMap } from '@/components/HomeMap'
import { HomeSheet } from '@/components/HomeSheet'
import { LocationSearchSheet } from '@/components/LocationSearchSheet'
import { Button } from '@/components/ui/button'
import { useNearbyStops } from '@/hooks/useNearbyStops'
import { useGeolocationStore } from '@/store/geolocationStore'
import { useRouteSearchStore } from '@/store/routeSearchStore'
import type { NearbyStop, SelectedPlace } from '@/types/common'

// Adelaide Center(CBD)
const ADELAIDE = { lat: -34.9285, lng: 138.6007 }

export default function HomePage() {
    // Temporary mock toggle until a real Supabase session check replaces it.
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(true)
    const [activeSnapPoint, setActiveSnapPoint] = useState<
        number | string | null
    >(0.5)

    // Shared across the whole app (survives this page unmounting on route
    // change) — granting once keeps the blue dot moving via watchPosition
    // instead of asking again every time /home remounts.
    const coords = useGeolocationStore((s) => s.coords)
    const permissionInitialized = useGeolocationStore((s) => s.initialized)
    const locating = useGeolocationStore((s) => s.locating)
    const enableLocation = useGeolocationStore((s) => s.enable)

    const located = coords != null
    const center = coords ?? ADELAIDE

    // Restoring this page from the back-forward cache (e.g. hitting Back
    // from a 404) resumes the frozen page instead of remounting it — but
    // Google Maps' WebGL canvas can come back blank since nothing tells it
    // to redraw. Bumping this key forces HomeMap to fully remount whenever
    // that happens.
    const [mapMountKey, setMapMountKey] = useState(0)
    useEffect(() => {
        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) setMapMountKey((k) => k + 1)
        }
        window.addEventListener('pageshow', handlePageShow)
        return () => window.removeEventListener('pageshow', handlePageShow)
    }, [])

    const [mapCenter, setMapCenter] = useState(ADELAIDE)

    // Seed the nearby-stops search center from the first GPS fix only —
    // after that `mapCenter` is driven purely by the user panning the map
    // (see onCenterChanged below), so later watchPosition updates (the user
    // actually walking around) don't yank the "nearby" list back to wherever
    // they currently are while they're looking at some other spot on the map.
    const seededMapCenter = useRef(false)
    useEffect(() => {
        if (coords && !seededMapCenter.current) {
            seededMapCenter.current = true
            setMapCenter(coords)
        }
    }, [coords])

    const { stops, loading: stopsLoading } = useNearbyStops(mapCenter)

    // The stop whose bubble is open on the map. Lives here (not in HomeMap)
    // so the sheet's "Nearby" list can also drive it, not just marker taps.
    const [selectedStop, setSelectedStop] = useState<NearbyStop | null>(null)

    const collapseSheet = () => setSheetOpen(false)
    const reopenSheet = () => {
        setActiveSnapPoint(0.5)
        setSheetOpen(true)
    }

    const handleStopPick = (stop: NearbyStop) => {
        setSelectedStop(stop)
        collapseSheet() // reveal the map + the bubble that's about to open
    }

    const router = useRouter()
    const [destSearchOpen, setDestSearchOpen] = useState(false)

    const handleOpenDestSearch = () => {
        setSheetOpen(false)
        setDestSearchOpen(true)
    }

    const handleDestinationPicked = async (destination: SelectedPlace) => {
        setDestSearchOpen(false)

        let here = coords
        if (!here) {
            const ok = await enableLocation()
            here = useGeolocationStore.getState().coords
            if (!ok || !here) {
                alert(
                    'Could not get your current location. Please allow location access and try again.'
                )
                return
            }
        }

        let label = 'Current Location'
        try {
            const res = await fetch(
                `/api/reverse-geocode?lat=${here.lat}&lng=${here.lng}`
            )
            const data = await res.json()
            if (data.address) label = data.address
        } catch {}

        useRouteSearchStore
            .getState()
            .setPendingSearch(
                { label, lat: here.lat, lng: here.lng },
                destination
            )
        router.push('/route')
    }

    return (
        <div className="relative h-full w-full overflow-hidden bg-gray-50">
            <HomeMap
                key={mapMountKey}
                center={center}
                located={located}
                stops={stops}
                onInteract={collapseSheet}
                onCenterChanged={setMapCenter}
                selectedStop={selectedStop}
                onSelectedStopChange={setSelectedStop}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                    <span className="pointer-events-auto rounded-full bg-primary px-4 py-2 text-lg font-extrabold text-primary-foreground shadow-lg">
                        Ade-Go Beep
                    </span>
                    {isAuthenticated && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="pointer-events-auto rounded-full bg-white shadow-lg hover:bg-white/90"
                            aria-label="Account"
                        >
                            <User className="size-5 text-primary" />
                        </Button>
                    )}
                </div>

                {permissionInitialized && !located && (
                    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">
                        <LocateFixed className="size-5 shrink-0 text-primary" />
                        <p className="flex-1 text-sm font-medium text-gray-700">
                            Enable location for nearby stops
                        </p>
                        <Button
                            size="sm"
                            className="rounded-full"
                            onClick={enableLocation}
                            disabled={locating}
                        >
                            {locating ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                'Enable'
                            )}
                        </Button>
                    </div>
                )}

                {/*{!isAuthenticated && (*/}
                {/*    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">*/}
                {/*        <Star className="size-5 shrink-0 fill-amber-400 text-amber-400" />*/}
                {/*        <p className="flex-1 text-sm font-medium text-gray-700">*/}
                {/*            Sign in for favourites &amp; history*/}
                {/*        </p>*/}
                {/*        <Button*/}
                {/*            size="sm"*/}
                {/*            className="rounded-full"*/}
                {/*            onClick={() => setIsAuthenticated(true)}*/}
                {/*        >*/}
                {/*            Sign in*/}
                {/*        </Button>*/}
                {/*    </div>*/}
                {/*)}*/}
            </div>

            <HomeSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                activeSnapPoint={activeSnapPoint}
                setActiveSnapPoint={setActiveSnapPoint}
                isAuthenticated={isAuthenticated}
                nearbyStops={stops}
                nearbyLoading={stopsLoading}
                onStopSelect={handleStopPick}
                onSearchInputClick={handleOpenDestSearch}
            />

            {destSearchOpen && (
                <LocationSearchSheet
                    isOpen={destSearchOpen}
                    onClose={() => setDestSearchOpen(false)}
                    title="Select Destination"
                    onLocationSelect={handleDestinationPicked}
                />
            )}

            {!sheetOpen && (
                <button
                    type="button"
                    onClick={reopenSheet}
                    className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-xl transition-transform active:scale-95"
                >
                    Where to?
                </button>
            )}
        </div>
    )
}
