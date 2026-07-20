'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, User } from 'lucide-react'
import { HomeMap } from '@/components/HomeMap'
import { HomeSheet } from '@/components/HomeSheet'
import { LocationSearchSheet } from '@/components/LocationSearchSheet'
import { Button } from '@/components/ui/button'
import { useNearbyStops } from '@/hooks/useNearbyStops'
import { useRouteSearchStore } from '@/store/routeSearchStore'
import type { NearbyStop, SelectedPlace } from '@/types/common'

// Adelaide CBD — 위치 권한이 없거나 실패했을 때의 기본 중심.
const ADELAIDE = { lat: -34.9285, lng: 138.6007 }

export default function HomePage() {
    // Temporary mock toggle until a real Supabase session check replaces it.
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(true)
    // 0.5: 검색창 + "Nearby Stops" 제목 다음에 정류장 최소 3개가 잘리지 않고
    // 보일 만큼의 높이 (0.4였을 땐 1~2개밖에 안 보이는 화면도 있었음).
    const [activeSnapPoint, setActiveSnapPoint] = useState<
        number | string | null
    >(0.5)

    const [center, setCenter] = useState(ADELAIDE)
    const [located, setLocated] = useState(false)

    // Follows wherever the user is currently looking at on the map (starts at
    // `center`, then moves on pan/zoom). Nearby stops are fetched for this,
    // not for `center` — `center` stays pinned to the actual GPS fix so the
    // blue "current location" dot doesn't drift when the user pans away.
    const [mapCenter, setMapCenter] = useState(ADELAIDE)

    useEffect(() => {
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const here = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                }
                setCenter(here)
                setMapCenter(here)
                setLocated(true)
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
    }, [])

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

    // "Where to?" input -> hand off to the same LocationSearchSheet /route
    // uses (destination mode, autocomplete). Picking one there sends the
    // user straight to /route with origin=here, destination=what they picked.
    const router = useRouter()
    const [destSearchOpen, setDestSearchOpen] = useState(false)

    const handleOpenDestSearch = () => {
        setSheetOpen(false)
        setDestSearchOpen(true)
    }

    const handleDestinationPicked = (destination: SelectedPlace) => {
        setDestSearchOpen(false)
        useRouteSearchStore
            .getState()
            .setPendingSearch(
                { label: 'Current Location', lat: center.lat, lng: center.lng },
                destination
            )
        router.push('/route')
    }

    return (
        // 모바일 폭(max-w-md) 앱 셸은 (main)/layout.tsx가 제공 — 여기선 그 안을 꽉 채우기만.
        <div className="relative h-full w-full overflow-hidden bg-gray-50">
            <HomeMap
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

                {!isAuthenticated && (
                    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">
                        <Star className="size-5 shrink-0 fill-amber-400 text-amber-400" />
                        <p className="flex-1 text-sm font-medium text-gray-700">
                            Sign in for favourites &amp; history
                        </p>
                        <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() => setIsAuthenticated(true)}
                        >
                            Sign in
                        </Button>
                    </div>
                )}
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
                    isAuthenticated={isAuthenticated}
                    onLocationSelect={handleDestinationPicked}
                    onLoginClick={() => setIsAuthenticated(true)}
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
