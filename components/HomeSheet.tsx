'use client'

import {
    BusFront,
    Clock,
    MapPin,
    Navigation,
    Search,
    TrainFront,
    TramFront,
} from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { NearbyStop, StopMode } from '@/types/common'
import { Spinner } from '@/components/ui/spinner'

const STOP_MODE_STYLE: Record<
    StopMode,
    { icon: typeof BusFront; iconClass: string; bgClass: string }
> = {
    BUS: { icon: BusFront, iconClass: 'text-primary', bgClass: 'bg-secondary' },
    TRAM: {
        icon: TramFront,
        iconClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
    },
    RAIL: {
        icon: TrainFront,
        iconClass: 'text-blue-600',
        bgClass: 'bg-blue-50',
    },
}

const favouriteStops = [
    { id: 'fav-1', name: 'King William St', code: 'KWS001' },
    { id: 'fav-2', name: 'University of Adelaide', code: 'UNIV01' },
]

const recentStops = [
    { id: 'rec-1', name: 'Henley Beach', code: 'HEN01' },
    { id: 'rec-2', name: 'Adelaide CBD', code: 'CBD01' },
    { id: 'rec-3', name: 'Glenelg', code: 'GLE01' },
]

function StopRow({
    name,
    code,
    distanceM,
    mode,
    onClick,
}: {
    name: string
    code: string | null
    distanceM?: number
    mode?: StopMode
    onClick?: () => void
}) {
    const style = mode ? STOP_MODE_STYLE[mode] : null
    const Icon = style?.icon ?? MapPin
    return (
        <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-xl p-3 hover:bg-gray-50 hover:text-foreground"
            onClick={onClick}
        >
            <div
                className={`rounded-full p-2 ${style?.bgClass ?? 'bg-secondary'}`}
            >
                <Icon
                    className={`size-4 ${style?.iconClass ?? 'text-primary'}`}
                />
            </div>
            <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">
                    {code ? `Stop ${code}` : 'Stop'}
                    {distanceM != null ? ` · ${distanceM} m` : ''}
                </p>
            </div>
        </Button>
    )
}

function NearbyList({
    stops,
    loading,
    onSelect,
}: {
    stops: NearbyStop[]
    loading: boolean
    onSelect: (stop: NearbyStop) => void
}) {
    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Spinner className="size-5 text-muted-foreground" />
            </div>
        )
    }
    if (stops.length === 0) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                No stops nearby.
            </p>
        )
    }
    return (
        <div className="space-y-1">
            {stops.map((stop) => (
                <StopRow
                    key={stop.id}
                    name={stop.name}
                    code={stop.code}
                    distanceM={stop.distanceM}
                    mode={stop.mode}
                    onClick={() => onSelect(stop)}
                />
            ))}
        </div>
    )
}

interface HomeSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    activeSnapPoint: number | string | null
    setActiveSnapPoint: (snapPoint: number | string | null) => void
    isAuthenticated: boolean
    nearbyStops: NearbyStop[]
    nearbyLoading: boolean
    onStopSelect: (stop: NearbyStop) => void
    // Hands off to LocationSearchSheet (same one /route uses) in destination
    // mode — this input itself doesn't do the autocomplete.
    onSearchInputClick: () => void
}

export function HomeSheet({
    open,
    onOpenChange,
    activeSnapPoint,
    setActiveSnapPoint,
    isAuthenticated,
    nearbyStops,
    nearbyLoading,
    onStopSelect,
    onSearchInputClick,
}: HomeSheetProps) {
    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            snapPoints={[0.5, 0.9]}
            activeSnapPoint={activeSnapPoint}
            setActiveSnapPoint={setActiveSnapPoint}
            modal={false}
            dismissible
            disablePreventScroll
        >
            <DrawerContent
                className="mx-auto max-w-md max-h-[90vh]"
                onPointerDownOutside={() => onOpenChange(false)}
            >
                <DrawerTitle className="sr-only">Where to?</DrawerTitle>
                <DrawerDescription className="sr-only">
                    Search a destination or pick a nearby stop
                </DrawerDescription>

                <div className="flex flex-col gap-4 overflow-y-auto px-4 pt-3 pb-24 scrollbar-thin">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Where to?"
                            className="h-12 rounded-xl border-0 bg-gray-50 pl-10 caret-transparent"
                            readOnly
                            onClick={onSearchInputClick}
                            onFocus={onSearchInputClick}
                        />
                    </div>

                    {isAuthenticated ? (
                        <Tabs defaultValue="nearby">
                            <TabsList className="w-full">
                                <TabsTrigger value="nearby">Nearby</TabsTrigger>
                                <TabsTrigger value="favourites">
                                    Favourites
                                </TabsTrigger>
                                <TabsTrigger value="recent">Recent</TabsTrigger>
                            </TabsList>
                            <TabsContent value="nearby">
                                <NearbyList
                                    stops={nearbyStops}
                                    loading={nearbyLoading}
                                    onSelect={onStopSelect}
                                />
                            </TabsContent>
                            <TabsContent
                                value="favourites"
                                className="space-y-1"
                            >
                                {favouriteStops.map((stop) => (
                                    <StopRow
                                        key={stop.id}
                                        name={stop.name}
                                        code={stop.code}
                                    />
                                ))}
                            </TabsContent>
                            <TabsContent value="recent" className="space-y-1">
                                {recentStops.map((stop) => (
                                    <StopRow
                                        key={stop.id}
                                        name={stop.name}
                                        code={stop.code}
                                    />
                                ))}
                            </TabsContent>
                        </Tabs>
                    ) : (
                        <div>
                            <h3 className="mb-2 px-1 font-semibold">
                                Nearby Stops
                            </h3>
                            <NearbyList
                                stops={nearbyStops}
                                loading={nearbyLoading}
                                onSelect={onStopSelect}
                            />
                        </div>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
