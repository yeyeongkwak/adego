'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
    APIProvider,
    InfoWindow,
    Map,
    Marker,
    useMap,
} from '@vis.gl/react-google-maps'
import type { MapEvent } from '@vis.gl/react-google-maps'
import { Loader2 } from 'lucide-react'
import type { NearbyStop } from '@/types/common'
import { useStopArrivals } from '@/hooks/useStopArrivals'

// Lives inside <Map> (useMap() only works for descendants of it) so picking
// a stop from the sheet's Nearby list can also recenter the map — the map
// itself stays uncontrolled (defaultCenter) so the user can still freely
// pan/zoom without fighting a controlled `center` prop.
function PanToSelectedStop({ stop }: { stop: NearbyStop | null }) {
    const map = useMap()
    useEffect(() => {
        if (map && stop) {
            map.panTo({ lat: stop.lat, lng: stop.lng })
        }
    }, [map, stop])
    return null
}

// Navy circle + lucide's <BusFront> glyph, baked into an SVG data URI —
// legacy google.maps.Marker only takes an image url/vector Symbol for its
// icon, not a React component. (Path data copied from
// lucide-react/dist/esm/icons/bus-front.mjs — tried generating this from
// the live component via react-dom/server's renderToStaticMarkup, but
// calling that at module scope runs during Next's SSR pass and corrupts
// React's hook dispatcher via a nested render, so: hand-copied it is.)
const BUS_STOP_ICON_URL =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#002D62" stroke="#FFFFFF" stroke-width="2.5"/>
            <g transform="translate(7,7) scale(0.75)" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 6 2 7"/>
                <path d="M10 6h4"/>
                <path d="m22 7-2-1"/>
                <rect width="16" height="16" x="4" y="3" rx="2"/>
                <path d="M4 11h16"/>
                <path d="M8 15h.01"/>
                <path d="M16 15h.01"/>
                <path d="M6 19v2"/>
                <path d="M18 21v-2"/>
            </g>
        </svg>`
    )

interface HomeMapProps {
    center: { lat: number; lng: number }
    located: boolean
    stops: NearbyStop[]
    onInteract: () => void
    // Fires once the map settles after a pan/zoom (not on every drag frame) —
    // used to refetch nearby stops for wherever the user is currently looking.
    onCenterChanged: (center: { lat: number; lng: number }) => void
    // Which stop's bubble is open — lifted up so the sheet's Nearby list can
    // also open/focus one, not just tapping its marker.
    selectedStop: NearbyStop | null
    onSelectedStopChange: (stop: NearbyStop | null) => void
}

export function HomeMap({
    center,
    located,
    stops,
    onInteract,
    onCenterChanged,
    selectedStop,
    onSelectedStopChange,
}: HomeMapProps) {
    const wheelAccum = useRef(0)
    // Only actually fetches while a stop is selected (enabled: !!stopId inside).
    const { arrivals, loading: arrivalsLoading } = useStopArrivals(
        selectedStop?.id ?? null
    )

    // Scrolling up (negative deltaY) on the map collapses the sheet, same as tapping it.
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            wheelAccum.current += e.deltaY
            if (wheelAccum.current < -40) {
                wheelAccum.current = 0
                onInteract()
            }
        },
        [onInteract]
    )

    // Clicking anywhere on the map that isn't a marker closes the bubble
    // (marker clicks don't bubble to this, so picking a stop still works).
    const handleMapClick = useCallback(() => {
        onSelectedStopChange(null)
        onInteract()
    }, [onInteract, onSelectedStopChange])

    const handleIdle = useCallback(
        (e: MapEvent) => {
            const c = e.map.getCenter()
            if (c) onCenterChanged({ lat: c.lat(), lng: c.lng() })
        },
        [onCenterChanged]
    )

    // A pan can refetch `stops` and drop the one currently open — close the
    // bubble instead of leaving it pinned to a stop that's no longer listed.
    // Guarded on stops.length: an empty list usually just means the nearby
    // query is mid-refetch (new center), not "confirmed this stop is gone" —
    // acting on that transient empty list was closing bubbles that were
    // just opened (e.g. from the sheet's Nearby list, which pans the map).
    useEffect(() => {
        if (
            selectedStop &&
            stops.length > 0 &&
            !stops.some((stop) => stop.id === selectedStop.id)
        ) {
            onSelectedStopChange(null)
        }
    }, [stops, selectedStop, onSelectedStopChange])

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
                Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </div>
        )
    }

    return (
        <div className="h-full w-full" onWheel={handleWheel}>
            <APIProvider apiKey={apiKey}>
                {/* `defaultCenter`만 쓰고 `center`(controlled)는 안 쓴다 — 사용자가
                    자유롭게 팬/줌할 수 있어야 하므로. 위치를 얻으면 key로 리마운트해
                    한 번만 재센터링. */}
                <Map
                    key={located ? 'located' : 'default'}
                    className="h-full w-full"
                    defaultCenter={center}
                    defaultZoom={18}
                    disableDefaultUI
                    clickableIcons={false}
                    gestureHandling="greedy"
                    onClick={handleMapClick}
                    onIdle={handleIdle}
                >
                    {/* 현재 위치: 파란 점 */}
                    <Marker
                        position={center}
                        title="Current location"
                        icon={{
                            path: 0 as google.maps.SymbolPath, // SymbolPath.CIRCLE
                            scale: 8,
                            fillColor: '#2563EB',
                            fillOpacity: 1,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 3,
                        }}
                    />
                    {/* 주변 정류장: 버스 아이콘 */}
                    {stops.map((stop) => (
                        <Marker
                            key={stop.id}
                            position={{ lat: stop.lat, lng: stop.lng }}
                            title={`${stop.name}${stop.code ? ` (${stop.code})` : ''}`}
                            icon={{
                                url: BUS_STOP_ICON_URL,
                                scaledSize: {
                                    width: 32,
                                    height: 32,
                                } as google.maps.Size,
                                anchor: { x: 16, y: 16 } as google.maps.Point,
                            }}
                            onClick={() => onSelectedStopChange(stop)}
                        />
                    ))}

                    <PanToSelectedStop stop={selectedStop} />

                    {selectedStop && (
                        <InfoWindow
                            // 정류장이 바뀔 때 같은 인스턴스에 close()+open()을 연달아
                            // 부르면 구글 InfoWindow가 다시 안 열리는 경우가 있어서,
                            // key로 매번 완전히 새 인스턴스로 마운트되게 강제함.
                            key={selectedStop.id}
                            position={{
                                lat: selectedStop.lat,
                                lng: selectedStop.lng,
                            }}
                            pixelOffset={[0, -8]}
                            onCloseClick={() => onSelectedStopChange(null)}
                            headerContent={
                                <p className="pr-2 text-sm font-semibold text-gray-900">
                                    {selectedStop.name}
                                </p>
                            }
                        >
                            <div className="min-w-40 px-1 py-0.5">
                                {selectedStop.code && (
                                    <p className="mb-1.5 text-xs text-gray-500">
                                        Stop {selectedStop.code}
                                    </p>
                                )}

                                {arrivalsLoading ? (
                                    <div className="flex items-center gap-2 py-1 text-xs text-gray-500">
                                        <Loader2 className="size-3 animate-spin" />
                                        Loading arrivals…
                                    </div>
                                ) : arrivals.length === 0 ? (
                                    <p className="py-1 text-xs text-gray-500">
                                        No upcoming arrivals
                                    </p>
                                ) : (
                                    <ul className="space-y-1">
                                        {arrivals.map((a) => (
                                            <li
                                                key={a.routeName}
                                                className="flex items-center justify-between gap-3"
                                            >
                                                <span
                                                    className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                                                    style={{
                                                        backgroundColor:
                                                            a.routeColor ??
                                                            '#002D62',
                                                    }}
                                                >
                                                    {a.routeName}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                                                    {a.isRealtime && (
                                                        <span
                                                            className="relative flex size-1.5"
                                                            title="Live"
                                                        >
                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                                                            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
                                                        </span>
                                                    )}
                                                    {a.minutesUntil <= 0
                                                        ? 'Due'
                                                        : `${a.minutesUntil} min`}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </InfoWindow>
                    )}
                </Map>
            </APIProvider>
        </div>
    )
}
