'use client'

import React, { useEffect, useState } from 'react'
import {
    firstTransitLeg,
    RouteListScreenProps,
    RouteSearchType,
    RouteTypes,
    SelectedPlace,
    TimeOption,
} from '@/types/common'
import { ArrowLeft, ArrowRight, ArrowUpDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LocationSearchSheet } from '@/components/LocationSearchSheet'
import { useDirections } from '@/hooks/useDirections'
import { Spinner } from '@/components/ui/spinner'
import { arrivalKey, useArrivals } from '@/hooks/useArrivals'
import { RouteRealTimeCard } from '@/components/RouteCardRealtime'
import { useRouteSearchStore } from '@/store/routeSearchStore'
import { cn } from '@/lib/utils/utils'

const RouteListPage = ({
    origin,
    destination,
    isAuthenticated = true,
    onRouteSelect,
    onBack,
    onLoginClick,
}: RouteListScreenProps) => {
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

    const [timeOption, setTimeOption] = useState<TimeOption>({
        mode: 'depart',
        time: 'now',
    })

    const [currentTime, setCurrentTime] = useState(new Date())

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

    const { arrivals } = useArrivals(options)

    useEffect(() => {
        const msToNextMinute = 60000 - (Date.now() % 60000)

        const timeout = setTimeout(() => {
            setCurrentTime(new Date())
            const interval = setInterval(() => {
                setCurrentTime(new Date())
            }, 60000)
            return () => clearInterval(interval)
        }, msToNextMinute)

        return () => clearTimeout(timeout)
    }, [])

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="bg-[#002D62] text-white sticky top-0 z-10 shadow-md">
                <div className="px-4 py-4">
                    <div className="flex items-center gap-3 mb-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="text-white hover:bg-white/90 hover:text-[#002D62] transition-all"
                        >
                            <ArrowLeft className="size-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="font-semibold text-xl tracking-tight">
                                Route Options
                            </h1>
                        </div>
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
                    <div className="flex items-center justify-between mt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/20 border-white/30 text-white hover:bg-white/90 hover:text-[#002D62] hover:border-white transition-all"
                        >
                            Leave now (
                            {currentTime.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                            )
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/90 hover:text-[#002D62] transition-all"
                            >
                                <ArrowLeft className="size-4" />
                            </Button>
                            <span className="text-sm font-medium">15 min</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/90 hover:text-[#002D62] transition-all"
                            >
                                <ArrowRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Route list section */}
            <div className="p-4 space-y-4">
                {loading && (
                    <div className="flex justify-center py-12">
                        <Spinner className="size-6 text-muted-foreground" />
                    </div>
                )}

                {!loading &&
                    selectedOrigin &&
                    selectedDestination &&
                    (options.length === 0 ? (
                        <p className="py-12 text-center text-sm text-gray-500">
                            {error ?? 'No route is available for this trip.'}
                        </p>
                    ) : (
                        options.map((option, i) => {
                            const boarding = firstTransitLeg(option)
                            const arrival = arrivals.get(
                                arrivalKey(
                                    boarding?.departureStopName,
                                    boarding?.routeName
                                )
                            )
                            return (
                                <RouteRealTimeCard
                                    key={i}
                                    option={option}
                                    arrival={arrival}
                                    arrivals={arrivals}
                                    isFastest={i === 0}
                                    onClick={() => {}}
                                />
                            )
                        })
                    ))}
            </div>
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
                    isAuthenticated={isAuthenticated}
                    onLocationSelect={handleLocationSelect}
                    onLoginClick={onLoginClick}
                />
            )}
        </div>
    )
}

export default RouteListPage
