'use client'

import { useState } from 'react'
import {
    ArrowLeft,
    BusFront,
    ChevronDown,
    Loader2,
    Search,
    TrainFront,
    TramFront,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useStopSearch } from '@/hooks/useStopSearch'
import { useStopArrivals } from '@/hooks/useStopArrivals'
import { STOP_ICON_DEFAULT_COLOR } from '@/util/map/stopIcons'
import { arrivalTimeLabel } from '@/util/time/clockTime'
import { cn } from '@/lib/utils/utils'
import type { NearbyStop, StopArrival, StopArrivalTime, StopMode } from '@/types/common'

const MODE_ICON: Record<StopMode, typeof BusFront> = {
    BUS: BusFront,
    TRAM: TramFront,
    RAIL: TrainFront,
}

function TimeLabel({ t }: { t: StopArrivalTime }) {
    return (
        <span className="flex items-center gap-1.5">
            {t.isRealtime && (
                <span className="relative flex size-1.5" title="Live">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
                </span>
            )}
            {arrivalTimeLabel(t.minutesUntil)}
        </span>
    )
}

// One route row. Collapsed shows just the soonest departure; if the stop has
// several trips queued up for this route, tapping it expands an accordion
// with the rest — all already fetched in the one /api/stops-arrivals call,
// so expanding costs no extra network round trip.
function RouteArrivalRow({ arrival }: { arrival: StopArrival }) {
    const [expanded, setExpanded] = useState(false)
    const [soonest, ...rest] = arrival.times
    const hasMore = rest.length > 0

    return (
        <li className="rounded-lg">
            <button
                type="button"
                onClick={() => hasMore && setExpanded((e) => !e)}
                disabled={!hasMore}
                className="flex w-full items-center justify-between gap-3 py-0.5 text-left"
            >
                <span
                    className="rounded px-2 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: arrival.routeColor ?? '#002D62' }}
                >
                    {arrival.routeName}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <TimeLabel t={soonest} />
                    {hasMore && (
                        <ChevronDown
                            className={cn(
                                'size-3.5 text-gray-400 transition-transform',
                                expanded && 'rotate-180'
                            )}
                        />
                    )}
                </span>
            </button>
            {expanded && hasMore && (
                <ul className="mt-1 space-y-1 border-t border-gray-100 pt-1.5">
                    {rest.map((t, i) => (
                        <li key={i} className="flex justify-end text-xs text-gray-500">
                            <TimeLabel t={t} />
                        </li>
                    ))}
                </ul>
            )}
        </li>
    )
}

export default function StopsPage() {
    const [query, setQuery] = useState('')
    const [selectedStop, setSelectedStop] = useState<NearbyStop | null>(null)
    const { stops, loading } = useStopSearch(query)
    const { arrivals, loading: arrivalsLoading } = useStopArrivals(
        selectedStop?.id ?? null
    )

    return (
        <div className="flex h-full flex-col bg-gray-50">
            <div className="bg-[#002D62] px-4 py-4 text-white shadow-md">
                <h1 className="mb-3 text-xl font-semibold tracking-tight">
                    Stops
                </h1>
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-gray-400" />
                    <Input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setSelectedStop(null)
                        }}
                        placeholder="Search for a stop"
                        className="h-12 rounded-lg border-0 bg-white pl-10 text-gray-900 shadow-none"
                        autoFocus
                    />
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto p-4">
                {selectedStop ? (
                    <div>
                        <button
                            type="button"
                            onClick={() => setSelectedStop(null)}
                            className="mb-3 flex items-center gap-1 text-sm font-medium text-gray-600"
                        >
                            <ArrowLeft className="size-4" />
                            Back to results
                        </button>

                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-base font-semibold text-gray-900">
                                {selectedStop.name}
                            </p>
                            {selectedStop.code && (
                                <p className="mb-3 text-xs text-gray-500">
                                    Stop {selectedStop.code}
                                </p>
                            )}

                            {arrivalsLoading ? (
                                <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                                    <Loader2 className="size-4 animate-spin" />
                                    Loading arrivals…
                                </div>
                            ) : arrivals.length === 0 ? (
                                <p className="py-4 text-sm text-gray-500">
                                    No upcoming arrivals
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {arrivals.map((a) => (
                                        <RouteArrivalRow
                                            key={a.routeName}
                                            arrival={a}
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ) : query.trim() ? (
                    loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : stops.length === 0 ? (
                        <p className="py-12 text-center text-sm text-gray-500">
                            No stops found for &quot;{query}&quot;.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {stops.map((stop) => {
                                const Icon = MODE_ICON[stop.mode]
                                return (
                                    <button
                                        key={stop.id}
                                        type="button"
                                        onClick={() => setSelectedStop(stop)}
                                        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition-colors hover:bg-gray-50"
                                    >
                                        <span
                                            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                                            style={{
                                                backgroundColor:
                                                    STOP_ICON_DEFAULT_COLOR[
                                                        stop.mode
                                                    ],
                                            }}
                                        >
                                            <Icon className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-gray-900">
                                                {stop.name}
                                            </span>
                                            {stop.code && (
                                                <span className="block text-xs text-gray-500">
                                                    Stop {stop.code}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <Search className="size-8 text-gray-300" />
                        <p className="text-sm text-gray-500">
                            Search for a stop to see what&apos;s coming.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
