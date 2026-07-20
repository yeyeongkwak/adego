// Countdown-first card. The hero number is "minutes until your bus",
// not a clock time — that's the whole pitch of this app.
//
// It also answers the question Google/Metro don't: can you actually
// make it, given how far you have to walk?

'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import {
    ArrowRight,
    Footprints,
    AlertTriangle,
    Check,
    MapPin,
} from 'lucide-react'
import type { IRouteOption, ILeg, Arrival } from '@/types/common'
import { firstTransitLeg, textOnColor } from '@/types/common'
import { vehicleIcon } from '@/util/transit/vehicleIcon'
import { FastestBadge } from '@/components/FastestBadge'
import { VehiclePositionSheet } from '@/components/VehiclePositionSheet'
import { arrivalKey } from '@/hooks/useArrivals'
import { cn } from '@/lib/utils/utils'

type Props = {
    option: IRouteOption
    arrival?: Arrival // boarding leg's realtime, for the hero countdown
    arrivals?: Map<string, Arrival> // every leg's realtime, for per-leg tracking
    isFastest?: boolean
    onClick?: () => void
}

// What the "track this vehicle" button/sheet needs for one leg.
type TrackedLeg = {
    tripId: string
    routeName?: string
    vehicleType?: string
}

function totalWalkMinutes(legs: ILeg[]): number {
    const sec = legs
        .filter((l) => l.mode === 'WALKING')
        .reduce((sum, l) => sum + l.durationSec, 0)
    return Math.round(sec / 60)
}

// Urgency drives the colour: red = run, amber = hurry, green = relax.
function countdownTone(minutes: number, walkMin: number) {
    if (minutes < walkMin) return 'text-red-600' // can't make it
    if (minutes - walkMin <= 2) return 'text-amber-600' // tight
    return 'text-green-600'
}

export function RouteRealTimeCard({
    option,
    arrival,
    arrivals,
    isFastest = false,
    onClick,
}: Props) {
    const transitLegs = option.legs.filter((l) => l.mode === 'TRANSIT')
    const walkMin = totalWalkMinutes(option.legs)
    const boarding = firstTransitLeg(option)

    const hasRealtime = arrival?.isRealtime && arrival.minutesUntil != null
    const mins = arrival?.minutesUntil ?? null
    const delayMin = arrival?.delaySeconds
        ? Math.round(arrival.delaySeconds / 60)
        : 0

    const canMakeIt = mins == null || mins >= walkMin

    // Whichever leg's vehicle the user tapped "track" on, if any — one sheet
    // instance shared across every leg's button.
    const [trackedLeg, setTrackedLeg] = useState<TrackedLeg | null>(null)

    return (
        <Card
            onClick={onClick}
            className={cn(
                'relative cursor-pointer gap-0 rounded-3xl border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.98]',
                isFastest && 'ring-2 ring-blue-500'
            )}
        >
            {isFastest && <FastestBadge />}

            {/* ---- Hero: countdown ---- */}
            <div className="mb-4 flex items-start justify-between">
                <div>
                    {hasRealtime ? (
                        <>
                            <div className="flex items-baseline gap-1.5">
                                <span
                                    className={`text-4xl font-black tabular-nums ${countdownTone(
                                        mins!,
                                        walkMin
                                    )}`}
                                >
                                    {mins}
                                </span>
                                <span
                                    className={`text-lg font-bold ${countdownTone(mins!, walkMin)}`}
                                >
                                    min
                                </span>
                                <span className="ml-1 flex size-2 rounded-full bg-green-500 animate-pulse" />
                            </div>
                            <p className="mt-0.5 text-xs font-medium text-gray-500">
                                until {boarding?.routeName}
                                {delayMin > 0 && (
                                    <span className="text-amber-600">
                                        {' '}
                                        · {delayMin} min late
                                    </span>
                                )}
                                {delayMin < 0 && (
                                    <span className="text-blue-600">
                                        {' '}
                                        · {-delayMin} min early
                                    </span>
                                )}
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="text-3xl font-black tabular-nums text-gray-400">
                                {option.departureText ?? '--'}
                            </div>
                            <p className="mt-0.5 text-xs font-medium text-gray-400">
                                scheduled · no live data
                            </p>
                        </>
                    )}
                </div>

                <div className="text-right">
                    <div className="text-sm font-bold text-gray-500">
                        arrive {option.arrivalText ?? '--'}
                    </div>
                    <div className="text-xs font-medium text-gray-400">
                        {option.durationText}
                    </div>
                </div>
            </div>

            {/* ---- Legs: walk + every vehicle (transfers visible) ---- */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5">
                    <Footprints className="size-3.5 text-gray-500" />
                    <span className="text-xs font-bold text-gray-600">
                        {walkMin} min
                    </span>
                </div>

                {transitLegs.map((leg, i) => {
                    const hasColor = !!leg.routeColor
                    const VehicleIcon = vehicleIcon(leg.vehicleType)
                    const legArrival = arrivals?.get(
                        arrivalKey(leg.departureStopName, leg.routeName)
                    )
                    const canTrackLeg =
                        legArrival?.isRealtime && !!legArrival.tripId

                    return (
                        <div key={i} className="flex items-center gap-2">
                            <ArrowRight className="size-3.5 stroke-[3] text-gray-300" />
                            <div
                                className={
                                    hasColor
                                        ? 'flex items-center gap-1 rounded-xl px-3 py-1.5 shadow-sm'
                                        : 'flex items-center gap-1 rounded-xl border-2 border-gray-700 bg-white px-3 py-1.5'
                                }
                                style={
                                    hasColor
                                        ? {
                                              backgroundColor: leg.routeColor,
                                              color: textOnColor(
                                                  leg.routeColor
                                              ),
                                          }
                                        : undefined
                                }
                            >
                                <VehicleIcon
                                    className={`size-3.5 ${!hasColor ? 'text-gray-700' : ''}`}
                                />
                                <span
                                    className={`text-xs font-black ${!hasColor ? 'text-gray-700' : ''}`}
                                >
                                    {leg.routeName}
                                </span>
                            </div>
                            {canTrackLeg && (
                                <button
                                    type="button"
                                    aria-label={`Check live location for ${leg.routeName}`}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setTrackedLeg({
                                            tripId: legArrival!.tripId!,
                                            routeName: leg.routeName,
                                            vehicleType: leg.vehicleType,
                                        })
                                    }}
                                    className="flex size-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                                >
                                    <MapPin className="size-3.5" />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* ---- Can you make it? (only meaningful with realtime) ---- */}
            {hasRealtime && (
                <div
                    className={`mb-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        canMakeIt
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                    }`}
                >
                    {canMakeIt ? (
                        <>
                            <Check className="size-3.5" />
                            {walkMin} min walk — you have time
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="size-3.5" />
                            {walkMin} min walk — you may miss it
                        </>
                    )}
                </div>
            )}

            <div className="border-t border-gray-50 pt-2">
                <span className="text-[11px] font-medium text-gray-400">
                    {boarding?.departureStopName ?? ''}
                </span>
            </div>

            <VehiclePositionSheet
                open={!!trackedLeg}
                onOpenChange={(open) => !open && setTrackedLeg(null)}
                tripId={trackedLeg?.tripId ?? null}
                routeName={trackedLeg?.routeName}
                vehicleType={trackedLeg?.vehicleType}
            />
        </Card>
    )
}
