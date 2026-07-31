// "Where's my bus?" bottom sheet — opened from a RouteRealTimeCard's vehicle button.
// Shows a small live map with the vehicle serving that card's tripId (see /api/vehicle-position for how that trip is resolved),
// the user's own location, and the vehicle's full route shape end to end (from /api/route-shape's GTFS static geometry)

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    APIProvider,
    Map,
    Marker,
    Polyline,
    useMap,
} from '@vis.gl/react-google-maps'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useVehiclePosition } from '@/hooks/useVehiclePosition'
import { useRouteShape, type RouteShapePoint } from '@/hooks/useRouteShape'
import {
    buildStopIconUrl,
    STOP_ICON_DEFAULT_COLOR,
    STOP_ICON_GLYPH,
} from '@/util/map/stopIcons'
import {
    VEHICLE_LABEL,
    vehicleTypeToStopMode,
} from '@/util/transit/vehicleIcon'

interface VehiclePositionSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tripId: string | null
    routeName?: string
    vehicleType?: string // picks the bus/tram/rail icon + its default color
    routeColor?: string // "#RRGGBB" — colors the icon + route line when known
}

function secondsAgoLabel(updatedAtSec: number): string {
    const sec = Math.max(0, Math.round(Date.now() / 1000 - updatedAtSec))
    if (sec < 60) return `${sec}s ago`
    return `${Math.round(sec / 60)} min ago`
}

// Draws the vehicle's full route shape in routeColor. Zoom/center tracks
// just vehicle + user (map stays uncontrolled/defaultCenter, this just
// nudges it via fitBounds whenever either moves) — the route line is drawn
// but deliberately NOT fit into view, since it's often much bigger than the
// vehicle-to-user distance and would zoom out far past what's useful.
function RouteOverlay({
    vehicle,
    user,
    path,
    color,
}: {
    vehicle: { lat: number; lng: number }
    user: { lat: number; lng: number } | null
    path: RouteShapePoint[] | null
    color: string
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
        map.fitBounds(bounds, 64) // px padding so nothing sits flush against the edges
        // eslint-disable-next-line react-hooks/exhaustive-deps -- vehicle/user are fresh object literals every render; track their primitives instead
    }, [map, vehicle.lat, vehicle.lng, user?.lat, user?.lng])

    if (!path?.length) return null
    return (
        <Polyline
            path={path}
            strokeColor={color}
            strokeOpacity={0.9}
            strokeWeight={4}
        />
    )
}

export function VehiclePositionSheet({
    open,
    onOpenChange,
    tripId,
    routeName,
    vehicleType,
    routeColor,
}: VehiclePositionSheetProps) {
    const { position, loading } = useVehiclePosition(open ? tripId : null)
    const { path: routePath } = useRouteShape(open ? tripId : null)
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const mode = vehicleTypeToStopMode(vehicleType)
    const iconColor = routeColor ?? STOP_ICON_DEFAULT_COLOR[mode]
    const iconUrl = buildStopIconUrl(iconColor, STOP_ICON_GLYPH[mode])
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

    // Vehicle + user as a bounds literal -> the map's very first frame is
    // already zoomed to their actual distance apart, instead of opening at a
    // fixed zoom and snapping to fitBounds a beat later. Deliberately not
    // sized to the full route (see RouteOverlay) — that'd zoom out to
    // whatever the route's extent is regardless of how close the bus is.
    const initialBounds = useMemo(() => {
        if (!position || !userLocation) return null
        return {
            north: Math.max(position.lat, userLocation.lat),
            south: Math.min(position.lat, userLocation.lat),
            east: Math.max(position.lng, userLocation.lng),
            west: Math.min(position.lng, userLocation.lng),
        }
    }, [position, userLocation])

    return (
        // This sheet is opened from a button inside a clickable RouteCard.
        // Its Drawer content is portaled to document.body, but React's
        // synthetic events still bubble along the *React* tree, not the DOM
        // tree — so without this, tapping the overlay to dismiss the sheet
        // also bubbles up into the card's own onClick and opens the route
        // detail sheet underneath it.
        <div onClick={(e) => e.stopPropagation()}>
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
                            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-600">
                                Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                            </div>
                        ) : loading ? (
                            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100">
                                <Spinner className="size-6 text-muted-foreground" />
                            </div>
                        ) : !position ? (
                            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-100 px-6 text-center text-sm text-gray-600">
                                No live position for this {label.toLowerCase()}{' '}
                                right now — it may not have started its trip
                                yet.
                            </div>
                        ) : (
                            <div className="h-full w-full overflow-hidden rounded-2xl">
                                <APIProvider apiKey={apiKey}>
                                    <Map
                                        className="h-full w-full"
                                        {...(initialBounds
                                            ? {
                                                  defaultBounds: {
                                                      ...initialBounds,
                                                      padding: 64,
                                                  },
                                              }
                                            : {
                                                  defaultCenter: {
                                                      lat: position.lat,
                                                      lng: position.lng,
                                                  },
                                                  defaultZoom: 16,
                                              })}
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
                                        <RouteOverlay
                                            vehicle={{
                                                lat: position.lat,
                                                lng: position.lng,
                                            }}
                                            user={userLocation}
                                            path={routePath}
                                            color={iconColor}
                                        />
                                    </Map>
                                </APIProvider>
                            </div>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
}
