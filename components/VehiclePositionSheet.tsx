// "Where's my bus?" bottom sheet — opened from a RouteRealTimeCard's vehicle
// button. Shows a small live map with both the vehicle serving that card's
// tripId (see /api/vehicle-position for how that trip is resolved) and the
// user's own location, so you can see how far away it actually is.

'use client'

import { useEffect, useState } from 'react'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useVehiclePosition } from '@/hooks/useVehiclePosition'
import { STOP_ICON_URL } from '@/util/map/stopIcons'
import {
    VEHICLE_LABEL,
    vehicleTypeToStopMode,
} from '@/util/transit/vehicleIcon'

interface VehiclePositionSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tripId: string | null
    routeName?: string
    vehicleType?: string // picks the bus/tram/rail icon
}

function secondsAgoLabel(updatedAtSec: number): string {
    const sec = Math.max(0, Math.round(Date.now() / 1000 - updatedAtSec))
    if (sec < 60) return `${sec}s ago`
    return `${Math.round(sec / 60)} min ago`
}

// Keeps both the vehicle and the user in view, refit whenever either moves —
// the map itself stays uncontrolled (defaultCenter), this just nudges it.
function FitToMarkers({
    vehicle,
    user,
}: {
    vehicle: { lat: number; lng: number }
    user: { lat: number; lng: number } | null
}) {
    const map = useMap()
    useEffect(() => {
        if (!map) return
        if (!user) {
            map.setCenter(vehicle)
            map.setZoom(16)
            return
        }
        const bounds = new google.maps.LatLngBounds()
        bounds.extend(vehicle)
        bounds.extend(user)
        map.fitBounds(bounds, 64) // px padding so markers aren't flush against the edges
    }, [map, vehicle.lat, vehicle.lng, user?.lat, user?.lng])
    return null
}

export function VehiclePositionSheet({
    open,
    onOpenChange,
    tripId,
    routeName,
    vehicleType,
}: VehiclePositionSheetProps) {
    const { position, loading } = useVehiclePosition(open ? tripId : null)
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const mode = vehicleTypeToStopMode(vehicleType)
    const iconUrl = STOP_ICON_URL[mode]
    const label = VEHICLE_LABEL[mode]

    const [userLocation, setUserLocation] = useState<{
        lat: number
        lng: number
    } | null>(null)

    useEffect(() => {
        if (!open || !navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
            (pos) =>
                setUserLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                }),
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
    }, [open])

    return (
        <Drawer open={open} onOpenChange={onOpenChange} dismissible>
            <DrawerContent className="mx-auto max-h-[88vh] max-w-md">
                <DrawerHeader>
                    <DrawerTitle>
                        {routeName ? `${label} ${routeName}` : label} · Live
                        location
                    </DrawerTitle>
                    <DrawerDescription>
                        {position
                            ? `Updated ${secondsAgoLabel(position.updatedAtSec)}`
                            : `Waiting for a GPS fix from this ${label.toLowerCase()}.`}
                    </DrawerDescription>
                </DrawerHeader>

                <div className="h-[60vh] w-full px-4 pb-4">
                    {!apiKey ? (
                        <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-500">
                            Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                        </div>
                    ) : loading ? (
                        <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100">
                            <Spinner className="size-6 text-muted-foreground" />
                        </div>
                    ) : !position ? (
                        <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100 px-6 text-center text-sm text-gray-500">
                            No live position for this {label.toLowerCase()}{' '}
                            right now — it may not have started its trip yet.
                        </div>
                    ) : (
                        <div className="h-full w-full overflow-hidden rounded-2xl">
                            <APIProvider apiKey={apiKey}>
                                <Map
                                    className="h-full w-full"
                                    defaultCenter={{
                                        lat: position.lat,
                                        lng: position.lng,
                                    }}
                                    defaultZoom={16}
                                    disableDefaultUI
                                    gestureHandling="greedy"
                                >
                                    <Marker
                                        position={{
                                            lat: position.lat,
                                            lng: position.lng,
                                        }}
                                        title={
                                            routeName
                                                ? `${label} ${routeName}`
                                                : label
                                        }
                                        icon={{
                                            url: iconUrl,
                                            scaledSize: {
                                                width: 32,
                                                height: 32,
                                            } as google.maps.Size,
                                            anchor: {
                                                x: 16,
                                                y: 16,
                                            } as google.maps.Point,
                                        }}
                                    />
                                    {userLocation && (
                                        <Marker
                                            position={userLocation}
                                            title="Your location"
                                            icon={{
                                                path: 0 as google.maps.SymbolPath, // SymbolPath.CIRCLE
                                                scale: 8,
                                                fillColor: '#2563EB',
                                                fillOpacity: 1,
                                                strokeColor: '#FFFFFF',
                                                strokeWeight: 3,
                                            }}
                                        />
                                    )}
                                    <FitToMarkers
                                        vehicle={{
                                            lat: position.lat,
                                            lng: position.lng,
                                        }}
                                        user={userLocation}
                                    />
                                </Map>
                            </APIProvider>
                        </div>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}