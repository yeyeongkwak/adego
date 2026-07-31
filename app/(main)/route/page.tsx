'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
    firstTransitLeg,
    IRouteOption,
    RouteSearchType,
    RouteTypes,
    SelectedPlace,
    TimeOption,
    transferCount,
} from '@/types/common'
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpDown,
    Clock,
    RefreshCw,
    Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { LocationSearchSheet } from '@/components/LocationSearchSheet'
import { useDirections } from '@/hooks/useDirections'
import { Spinner } from '@/components/ui/spinner'
import { useArrivals } from '@/hooks/useArrivals'
import { RouteRealTimeCard } from '@/components/RouteCardRealtime'
import { RouteDetailSheet } from '@/components/RouteDetailSheet'
import { TimePickerSheet } from '@/components/TimePickerSheet'
import { useRouteSearchStore } from '@/store/routeSearchStore'
import { cn } from '@/lib/utils/utils'

const TIME_STEP_MINUTES = 15

const RouteListPage = () => {
    const [detailOption, setDetailOption] = useState<IRouteOption | null>(null)
    const [searchSheetOpen, setSearchSheetOpen] = useState(false)
    const [editingField, setEditingField] = useState<RouteSearchType | null>(
        null
    )

    const [initialSearch] = useState(() =>
        useRouteSearchStore.getState().consumePendingSearch()
    )
    const [selectedOrigin, setSelectedOrigin] = useState<SelectedPlace | null>(
        initialSearch.origin
    )
    const [selectedDestination, setSelectedDestination] =
        useState<SelectedPlace | null>(initialSearch.destination)

    // Visiting /route directly (refresh, bookmark, etc. — no pending search
    // handoff from Home) used to leave origin empty until manually picked.
    // Home's "Where to" flow already defaults it to current location, so do
    // the same here for consistency. Only fires once at mount, and only
    // when origin is still unset; on denial/failure it just leaves the
    // "Select Origin" placeholder rather than guessing.
    useEffect(() => {
        if (selectedOrigin || !navigator.geolocation) return
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
                setSelectedOrigin({ label, lat, lng })
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once at mount only; selectedOrigin is read purely as an at-mount guard, not something this should re-run for
    }, [])

    const [timeOption, setTimeOption] = useState<TimeOption>({
        mode: 'depart',
        time: 'now',
    })
    const [timePickerOpen, setTimePickerOpen] = useState(false)
    const [routeType, setRouteType] = useState<RouteTypes>(RouteTypes.FASTEST)

    const shiftTime = (deltaMinutes: number) => {
        setTimeOption((prev) => {
            const base = prev.time === 'now' ? new Date() : new Date(prev.time)
            const next = new Date(base.getTime() + deltaMinutes * 60_000)
            return { mode: prev.mode, time: next.toISOString() }
        })
    }

    const handleOpenOriginSearch = () => {
        setEditingField(RouteSearchType.ORIGIN)
        setSearchSheetOpen(true)
    }

    const handleOpenDestinationSearch = () => {
        setEditingField(RouteSearchType.DESTINATION)
        setSearchSheetOpen(true)
    }

    const handleLocationSelect = (location: SelectedPlace) => {
        if (editingField === RouteSearchType.ORIGIN) {
            setSelectedOrigin(location)
        } else if (editingField === RouteSearchType.DESTINATION) {
            setSelectedDestination(location)
        }
        setSearchSheetOpen(false)
        setEditingField(null)
    }

    const handleSwapLocations = () => {
        const temp = selectedOrigin
        setSelectedOrigin(selectedDestination)
        setSelectedDestination(temp)
    }

    const { options, loading, refreshing, error, refetch } = useDirections(
        selectedOrigin,
        selectedDestination,
        timeOption
    )

    const isNow = timeOption.time === 'now'
    const { arrivals, loading: arrivalsLoading } = useArrivals(
        isNow ? options : []
    )
    const showLoading = loading || (isNow && arrivalsLoading)

    const fastestOption = useMemo<IRouteOption | null>(() => {
        if (options.length === 0) return null
        return options.reduce((best, o) =>
            o.durationSec < best.durationSec ? o : best
        )
    }, [options])

    const displayedOptions = useMemo(() => {
        const sorted = [...options]
        if (routeType === RouteTypes.LEAST_TRANSFER) {
            sorted.sort(
                (a, b) =>
                    transferCount(a) - transferCount(b) ||
                    a.durationSec - b.durationSec
            )
        } else {
            sorted.sort((a, b) => a.durationSec - b.durationSec)
        }
        return sorted
    }, [options, routeType])

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            <div className="bg-[#002D62] text-white sticky top-0 z-10 shadow-md">
                <div className="px-4 py-4">
                    <div className="mb-4">
                        <PageHeader
                            title="Route Options"
                            right={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={refreshing}
                                    className="text-white hover:bg-white/90 hover:text-[#002D62] transition-all"
                                    onClick={() => refetch()}
                                >
                                    <RefreshCw
                                        className={cn(
                                            'size-5',
                                            refreshing && 'animate-spin'
                                        )}
                                    />
                                </Button>
                            }
                        />
                    </div>

                    {/* Origin & Destination */}
                    <Card className="flex-row items-center gap-4 rounded-xl border-white/20 bg-white/10 p-4 text-white backdrop-blur-sm">
                        <div className="flex-1 min-w-0">
                            <Button
                                key={`origin-${selectedOrigin?.label}`}
                                variant="ghost"
                                onClick={handleOpenOriginSearch}
                                className="w-full h-auto justify-start gap-3 mb-2 p-2 rounded-lg text-left hover:bg-white/10 hover:text-white"
                            >
                                <div className="size-3 rounded-full bg-white shadow-sm flex-shrink-0" />
                                <span className="text-sm font-medium text-left truncate">
                                    {selectedOrigin?.label || 'Select Origin'}
                                </span>
                            </Button>
                            <Button
                                key={`destination-${selectedDestination}`}
                                variant="ghost"
                                onClick={handleOpenDestinationSearch}
                                className="w-full h-auto justify-start gap-3 p-2 rounded-lg text-left hover:bg-white/10 hover:text-white"
                            >
                                <div className="size-3 rounded-full bg-[#D4183D] shadow-sm flex-shrink-0" />
                                <span className="text-sm font-medium text-left truncate">
                                    {selectedDestination?.label ||
                                        'Select Destination'}
                                </span>
                            </Button>
                        </div>
                        <div className="flex-shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSwapLocations}
                                className="bg-white/20 text-white rounded-full hover:bg-white/90"
                                aria-label="Swap origin and destination"
                            >
                                <ArrowUpDown className="size-4" />
                            </Button>
                        </div>
                    </Card>

                    {/* Time Controls */}
                    <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setTimeOption({
                                        mode: 'depart',
                                        time: 'now',
                                    })
                                }
                                className={cn(
                                    'text-white transition-all hover:bg-white/90 hover:text-[#002D62]',
                                    isNow
                                        ? 'border-white/30 bg-white/20'
                                        : 'border-transparent bg-transparent text-white/70'
                                )}
                            >
                                Leave now
                            </Button>
                            <Button
                                variant="outline"
                                size={isNow ? 'icon' : 'sm'}
                                aria-label="Choose departure or arrival time"
                                onClick={() => setTimePickerOpen(true)}
                                className={cn(
                                    'text-white transition-all hover:bg-white/90 hover:text-[#002D62]',
                                    isNow
                                        ? 'border-transparent bg-transparent'
                                        : 'border-white/30 bg-white/20'
                                )}
                            >
                                <Clock className="size-4 shrink-0" />
                                {!isNow && (
                                    <span className="truncate text-sm font-medium whitespace-nowrap">
                                        {new Date(
                                            timeOption.time
                                        ).toLocaleTimeString('en-AU', {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true,
                                            timeZone: 'Australia/Adelaide',
                                        })}
                                    </span>
                                )}
                            </Button>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${TIME_STEP_MINUTES} min earlier`}
                                onClick={() => shiftTime(-TIME_STEP_MINUTES)}
                                className="text-white hover:bg-white/90 hover:text-[#002D62] transition-all"
                            >
                                <ArrowLeft className="size-4" />
                            </Button>
                            <span className="text-sm font-medium whitespace-nowrap">
                                {TIME_STEP_MINUTES}m
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${TIME_STEP_MINUTES} min later`}
                                onClick={() => shiftTime(TIME_STEP_MINUTES)}
                                className="text-white hover:bg-white/90 hover:text-[#002D62] transition-all"
                            >
                                <ArrowRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fastest / fewest-transfers tabs */}

            {displayedOptions.length > 0 && (
                <div className="flex gap-2 px-4 pt-4">
                    <button
                        type="button"
                        onClick={() => setRouteType(RouteTypes.FASTEST)}
                        className={cn(
                            'flex-1 rounded-full py-2 text-sm font-semibold transition-colors',
                            routeType === RouteTypes.FASTEST
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-gray-100 text-gray-600'
                        )}
                    >
                        Fastest
                    </button>
                    <button
                        type="button"
                        onClick={() => setRouteType(RouteTypes.LEAST_TRANSFER)}
                        className={cn(
                            'flex-1 rounded-full py-2 text-sm font-semibold transition-colors',
                            routeType === RouteTypes.LEAST_TRANSFER
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-gray-100 text-gray-600'
                        )}
                    >
                        Fewest transfers
                    </button>
                </div>
            )}

            {/* Route list section */}
            <div className="flex flex-1 flex-col p-4">
                {showLoading && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Spinner className="size-6" />
                        <span className="text-sm">Loading...</span>
                    </div>
                )}
                {!showLoading && (!selectedOrigin || !selectedDestination) && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <Search className="size-8 text-gray-300" />
                        <p className="text-sm text-gray-500">
                            Please select departure or destination for route
                            search.
                        </p>
                    </div>
                )}

                {!showLoading &&
                    selectedOrigin &&
                    selectedDestination &&
                    (displayedOptions.length === 0 ? (
                        <p className="py-12 text-center text-sm text-gray-500">
                            {error ?? 'No route is available for this trip.'}
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {displayedOptions.map((option, i) => {
                                const boarding = firstTransitLeg(option)
                                const arrival = boarding
                                    ? arrivals.get(boarding)
                                    : undefined
                                return (
                                    <RouteRealTimeCard
                                        key={i}
                                        option={option}
                                        arrival={arrival}
                                        arrivals={arrivals}
                                        isFastest={option === fastestOption}
                                        onClick={() => setDetailOption(option)}
                                    />
                                )
                            })}
                        </div>
                    ))}
            </div>
            <TimePickerSheet
                open={timePickerOpen}
                onOpenChange={setTimePickerOpen}
                value={timeOption}
                onApply={setTimeOption}
            />
            <RouteDetailSheet
                option={detailOption}
                onClose={() => setDetailOption(null)}
                originLabel={selectedOrigin?.label}
                destinationLabel={selectedDestination?.label}
            />
            {searchSheetOpen && (
                <LocationSearchSheet
                    isOpen={searchSheetOpen}
                    onClose={() => {
                        setSearchSheetOpen(false)
                        setEditingField(null)
                    }}
                    title={
                        editingField === RouteSearchType.ORIGIN
                            ? 'Select Origin'
                            : 'Select Destination'
                    }
                    onLocationSelect={handleLocationSelect}
                />
            )}
        </div>
    )
}

export default RouteListPage
