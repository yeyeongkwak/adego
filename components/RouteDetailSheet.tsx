'use client'

import { useEffect, useState } from 'react'
import {
    APIProvider,
    Map,
    Marker,
    Polyline,
    useMap,
} from '@vis.gl/react-google-maps'
import { ArrowLeft, Footprints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { vehicleIcon, vehicleTypeToStopMode } from '@/util/transit/vehicleIcon'
import { STOP_ICON_URL } from '@/util/map/stopIcons'
import { formatDurationText } from '@/util/time/duration'
import { cn } from '@/lib/utils/utils'
import { textOnColor, type ILeg, type IRouteOption } from '@/types/common'

interface RouteDetailSheetProps {
    option: IRouteOption | null
    onClose: () => void
    originLabel?: string
    destinationLabel?: string
}

type WalkItem = {
    type: 'walk'
    durationSec: number
    durationText: string
    from: string
    to: string
    path: { lat: number; lng: number }[]
    legIndices: number[] // raw option.legs indices this merged row covers — lets the map skip drawing the base layer for whichever legs are currently highlighted
}
type TransitItem = { type: 'transit'; leg: ILeg; legIndices: number[] }

function buildDisplayLegs(
    legs: ILeg[],
    originLabel: string,
    destinationLabel: string
): (WalkItem | TransitItem)[] {
    const items: (WalkItem | TransitItem)[] = []
    let i = 0
    while (i < legs.length) {
        const leg = legs[i]
        if (leg.mode !== 'WALKING') {
            items.push({ type: 'transit', leg, legIndices: [i] })
            i++
            continue
        }

        let durationSec = 0
        let path: { lat: number; lng: number }[] = []
        let j = i
        while (j < legs.length && legs[j].mode === 'WALKING') {
            durationSec += legs[j].durationSec
            path = path.concat(legs[j].path)
            j++
        }

        const prevTransit = legs
            .slice(0, i)
            .reverse()
            .find((l) => l.mode === 'TRANSIT')
        const nextTransit = legs.slice(j).find((l) => l.mode === 'TRANSIT')

        items.push({
            type: 'walk',
            durationSec,
            durationText: formatDurationText(durationSec),
            from: prevTransit?.arrivalStopName ?? originLabel,
            to: nextTransit?.departureStopName ?? destinationLabel,
            path,
            legIndices: Array.from({ length: j - i }, (_, k) => i + k),
        })
        i = j
    }
    return items
}

function FitToPath({ path }: { path: { lat: number; lng: number }[] }) {
    const map = useMap()
    useEffect(() => {
        if (!map || path.length === 0) return
        const bounds = new google.maps.LatLngBounds()
        for (const point of path) bounds.extend(point)
        map.fitBounds(bounds, 48)
    }, [map, path])
    return null
}

export function RouteDetailSheet({
    option,
    onClose,
    originLabel = 'Origin',
    destinationLabel = 'Destination',
}: RouteDetailSheetProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const displayLegs = option
        ? buildDisplayLegs(option.legs, originLabel, destinationLabel)
        : []

    // Which leg row is focused on the map, if any — reset whenever a
    // different route is opened (adjusted during render, same "reset state
    // when a prop changes" pattern used in TimePickerSheet/useAutocomplete).
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [prevOption, setPrevOption] = useState(option)
    if (option !== prevOption) {
        setPrevOption(option)
        setSelectedIndex(null)
    }

    const selectedItem =
        selectedIndex != null ? displayLegs[selectedIndex] : undefined

    const focusPath = selectedItem
        ? selectedItem.type === 'walk'
            ? selectedItem.path
            : selectedItem.leg.path
        : (option?.path ?? [])

    const selectedLegIndices = new Set(selectedItem?.legIndices ?? [])

    const [userLocation, setUserLocation] = useState<{
        lat: number
        lng: number
    } | null>(null)
    useEffect(() => {
        if (!option || !navigator.geolocation) return
        const watchId = navigator.geolocation.watchPosition(
            (pos) =>
                setUserLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                }),
            () => {},
            { enableHighAccuracy: true, maximumAge: 10_000 }
        )
        return () => navigator.geolocation.clearWatch(watchId)
    }, [option])

    if (!option) return null

    return (
        <div className="animate-in slide-in-from-bottom fixed inset-0 z-[70] mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-gray-50 duration-300">
            <div className="flex items-center gap-3 bg-[#002D62] px-4 py-4 text-white shadow-md">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white hover:bg-white/90 hover:text-[#002D62]"
                >
                    <ArrowLeft className="size-5" />
                </Button>
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                        {option.durationText} total
                    </h1>
                    <p className="text-xs text-white/70">
                        {option.departureText ?? '--'} →{' '}
                        {option.arrivalText ?? '--'}
                    </p>
                </div>
            </div>

            {/* Fixed 2:1 split (map:steps) rather than a draggable overlay —
                vaul's snapPoints assume the drawer content is nearly
                full-viewport tall to compute its peek offset, so a route
                with only a couple of legs (short content) got translated
                completely off-screen instead of just peeking. */}
            <div className="relative flex-[2]">
                <div className="absolute inset-0">
                    {!apiKey ? (
                        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
                            Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                        </div>
                    ) : option.path.length === 0 ? (
                        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
                            No route shape available
                        </div>
                    ) : (
                        <APIProvider apiKey={apiKey}>
                            <Map
                                className="h-full w-full"
                                defaultCenter={option.path[0]}
                                defaultZoom={13}
                                disableDefaultUI
                                gestureHandling="greedy"
                            >
                                {option.legs.map((leg, i) =>
                                    leg.path.length === 0 ||
                                    selectedLegIndices.has(
                                        i
                                    ) ? null : leg.mode === 'WALKING' ? (
                                        <Polyline
                                            key={i}
                                            path={leg.path}
                                            strokeOpacity={0}
                                            strokeColor="#002D62"
                                            icons={[
                                                {
                                                    icon: {
                                                        path: 'M 0,-1 0,1',
                                                        strokeOpacity: 0.9,
                                                        scale: 3,
                                                    },
                                                    offset: '0',
                                                    repeat: '12px',
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <Polyline
                                            key={i}
                                            path={leg.path}
                                            strokeColor={
                                                leg.routeColor ?? '#002D62'
                                            }
                                            strokeOpacity={0.9}
                                            strokeWeight={4}
                                        />
                                    )
                                )}
                                {selectedItem &&
                                    focusPath.length > 0 &&
                                    (selectedItem.type === 'walk' ? (
                                        <Polyline
                                            path={focusPath}
                                            strokeOpacity={0}
                                            strokeColor="#FFC55A"
                                            icons={[
                                                {
                                                    icon: {
                                                        path: 'M 0,-1 0,1',
                                                        strokeOpacity: 1,
                                                        scale: 4,
                                                    },
                                                    offset: '0',
                                                    repeat: '14px',
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <Polyline
                                            path={focusPath}
                                            strokeColor="#FFC55A"
                                            strokeOpacity={1}
                                            strokeWeight={6}
                                        />
                                    ))}
                                {option.legs.flatMap((leg, i) => {
                                    if (
                                        leg.mode !== 'TRANSIT' ||
                                        leg.path.length === 0
                                    )
                                        return []
                                    const mode = vehicleTypeToStopMode(
                                        leg.vehicleType
                                    )
                                    const iconUrl = STOP_ICON_URL[mode]
                                    const iconOpts = {
                                        url: iconUrl,
                                        scaledSize: {
                                            width: 22,
                                            height: 22,
                                        } as google.maps.Size,
                                        anchor: {
                                            x: 11,
                                            y: 11,
                                        } as google.maps.Point,
                                    }
                                    return [
                                        <Marker
                                            key={`${i}-dep`}
                                            position={leg.path[0]}
                                            title={leg.departureStopName}
                                            icon={iconOpts}
                                        />,
                                        <Marker
                                            key={`${i}-arr`}
                                            position={
                                                leg.path[leg.path.length - 1]
                                            }
                                            title={leg.arrivalStopName}
                                            icon={iconOpts}
                                        />,
                                    ]
                                })}
                                <Marker
                                    position={option.path[0]}
                                    title="Origin"
                                    icon={{
                                        path: 0 as google.maps.SymbolPath,
                                        scale: 7,
                                        fillColor: '#FFFFFF',
                                        fillOpacity: 1,
                                        strokeColor: '#002D62',
                                        strokeWeight: 3,
                                    }}
                                />
                                <Marker
                                    position={
                                        option.path[option.path.length - 1]
                                    }
                                    title="Destination"
                                    icon={{
                                        path: 0 as google.maps.SymbolPath,
                                        scale: 7,
                                        fillColor: '#D4183D',
                                        fillOpacity: 1,
                                        strokeColor: '#FFFFFF',
                                        strokeWeight: 3,
                                    }}
                                />
                                {userLocation && (
                                    <Marker
                                        position={userLocation}
                                        title="Your location"
                                        icon={{
                                            path: 0 as google.maps.SymbolPath,
                                            scale: 8,
                                            fillColor: '#2563EB',
                                            fillOpacity: 1,
                                            strokeColor: '#FFFFFF',
                                            strokeWeight: 3,
                                        }}
                                    />
                                )}
                                <FitToPath path={focusPath} />
                            </Map>
                        </APIProvider>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto border-t border-gray-100 bg-gray-50 px-4 py-3 scrollbar-thin">
                <ul className="space-y-3">
                    {displayLegs.map((item, i) => {
                        const isSelected = selectedIndex === i
                        const toggle = () =>
                            setSelectedIndex(isSelected ? null : i)

                        if (item.type === 'walk') {
                            return (
                                <li key={i}>
                                    <button
                                        type="button"
                                        onClick={toggle}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition-all',
                                            isSelected && 'ring-2 ring-accent'
                                        )}
                                    >
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                                            <Footprints className="size-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-700">
                                                Walk {item.durationText}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.from} → {item.to}
                                            </p>
                                        </div>
                                    </button>
                                </li>
                            )
                        }

                        const leg = item.leg
                        const VehicleIcon = vehicleIcon(leg.vehicleType)
                        const hasColor = !!leg.routeColor
                        return (
                            <li key={i}>
                                <button
                                    type="button"
                                    onClick={toggle}
                                    className={cn(
                                        'flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition-all',
                                        isSelected && 'ring-2 ring-accent'
                                    )}
                                >
                                    <span
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full"
                                        style={{
                                            backgroundColor: hasColor
                                                ? leg.routeColor
                                                : '#374151',
                                            color: hasColor
                                                ? textOnColor(leg.routeColor)
                                                : '#FFFFFF',
                                        }}
                                    >
                                        <VehicleIcon className="size-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {leg.routeName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {leg.departureStopName} →{' '}
                                            {leg.arrivalStopName}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {leg.durationText}
                                            {leg.numStops != null &&
                                                ` · ${leg.numStops} stop${leg.numStops === 1 ? '' : 's'}`}
                                        </p>
                                    </div>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    )
}
