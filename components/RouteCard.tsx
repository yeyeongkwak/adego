// One route option = one card. Renders every leg, so transfers show up
// (e.g. 801 -> J1). Chip colours come from the route (routeColor);
// vehicle type only picks the icon.

'use client'

import { Card } from '@/components/ui/card'
import { ArrowRight, Clock, Footprints } from 'lucide-react'
import { IRouteOption, ILeg, textOnColor } from '@/types/common'
import { firstTransitLeg } from '@/types/common'
import { vehicleIcon } from '@/util/transit/vehicleIcon'
import { FastestBadge } from '@/components/FastestBadge'
import { cn } from '@/lib/utils/utils'

type Props = {
    option: IRouteOption
    isFastest?: boolean
    onClick?: () => void
}

// Total walking time across the whole trip (some options walk 20+ min)
function totalWalkMinutes(legs: ILeg[]): number {
    const sec = legs
        .filter((l) => l.mode === 'WALKING')
        .reduce((sum, l) => sum + l.durationSec, 0)
    return Math.round(sec / 60)
}

export function RouteCard({ option, isFastest = false, onClick }: Props) {
    const transitLegs = option.legs.filter((l) => l.mode === 'TRANSIT')
    const walkMin = totalWalkMinutes(option.legs)
    const boarding = firstTransitLeg(option) // the vehicle they need to catch

    return (
        <Card
            onClick={onClick}
            className={cn(
                'group relative cursor-pointer gap-0 rounded-3xl border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.98]',
                isFastest && 'ring-2 ring-blue-500'
            )}
        >
            {isFastest && <FastestBadge />}

            {/* Times + total duration */}
            <div className="mb-4 flex items-start justify-between">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">
                        {option.departureText ?? '--'}
                    </span>
                    <ArrowRight className="size-4 stroke-3 text-gray-300" />
                    <span className="text-2xl font-black text-gray-900">
                        {option.arrivalText ?? '--'}
                    </span>
                </div>
                <div className="text-right">
                    <div className="text-xl font-black text-blue-600">
                        {option.durationText}
                    </div>
                </div>
            </div>

            {/* Leg chips — walk time, then every vehicle (transfers included) */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {/* Total walking, as one chip */}
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5">
                    <Footprints className="size-3.5 text-gray-500" />
                    <span className="text-xs font-bold text-gray-600">
                        {walkMin} min
                    </span>
                </div>

                {/* One chip per vehicle — this is what shows transfers */}
                {transitLegs.map((leg, i) => {
                    const hasColor = !!leg.routeColor
                    const VehicleIcon = vehicleIcon(leg.vehicleType)

                    return (
                        <div key={i} className="flex items-center gap-2">
                            <ArrowRight className="size-3.5 stroke-3 text-gray-300" />
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
                        </div>
                    )
                })}
            </div>

            {/* Footer: realtime countdown (later) + boarding stop */}
            <div className="flex items-center justify-between border-t border-gray-50 pt-2">
                <div className="flex items-center gap-1.5 text-green-600">
                    <Clock className="size-4" />
                    <span className="text-xs font-bold">
                        {/* GTFS-R fills this in later. For now show the scheduled time. */}
                        {boarding?.departureIn ??
                            `Departs ${option.departureText ?? ''}`}
                    </span>
                </div>
                <span className="max-w-37.5 truncate text-[11px] font-medium text-gray-400">
                    {boarding?.departureStopName ?? ''}
                </span>
            </div>
        </Card>
    )
}
