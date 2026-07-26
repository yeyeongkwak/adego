import { BusFront, Star, TrainFront, TramFront } from 'lucide-react'
import { STOP_ICON_DEFAULT_COLOR } from '@/util/map/stopIcons'
import { cn } from '@/lib/utils/utils'
import type { NearbyStop, StopMode } from '@/types/common'

const MODE_ICON: Record<StopMode, typeof BusFront> = {
    BUS: BusFront,
    TRAM: TramFront,
    RAIL: TrainFront,
}

// One stop row — icon + name/code (tap to open its arrivals) plus a star to
// toggle favouriting it. Shared between /stops (search results + favourites
// list) and /favorite (favourite stops tab).
export function StopRow({
    stop,
    isFavorite,
    onSelect,
    onToggleFavorite,
}: {
    stop: NearbyStop
    isFavorite: boolean
    onSelect: () => void
    onToggleFavorite: () => void
}) {
    const Icon = MODE_ICON[stop.mode]
    return (
        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm transition-colors hover:bg-gray-50">
            <button
                type="button"
                onClick={onSelect}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
                <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                    style={{
                        backgroundColor: STOP_ICON_DEFAULT_COLOR[stop.mode],
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
            <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={
                    isFavorite ? 'Remove from favourites' : 'Add to favourites'
                }
                className="shrink-0 p-1 text-gray-300 transition-colors hover:text-amber-400"
            >
                <Star
                    className={cn(
                        'size-4',
                        isFavorite && 'fill-amber-400 text-amber-400'
                    )}
                />
            </button>
        </div>
    )
}
