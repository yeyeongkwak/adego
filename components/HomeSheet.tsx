'use client'

import { Clock, MapPin, Navigation, Search } from 'lucide-react'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { NearbyStop } from '@/types/common'
import { Spinner } from '@/components/ui/spinner'

// Favourites/Recent은 아직 목업 — 로그인/DB 연동 후 교체.
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
    onClick,
}: {
    name: string
    code: string | null
    distanceM?: number
    onClick?: () => void
}) {
    return (
        <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-xl p-3 hover:bg-gray-50 hover:text-foreground"
            onClick={onClick}
        >
            <div className="rounded-full bg-secondary p-2">
                <MapPin className="size-4 text-primary" />
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
            // false였으면 가장 작은 snap point(0.5) 밑으로는 못 내려가고 거기서
            // 다시 튕겨 올라옴 — 끝까지 드래그하면 완전히 닫히게 하려면 true여야 함.
            dismissible
            // vaul의 body 스크롤 잠금이 시트 밖(지도)의 터치 드래그까지 막아서 해제.
            disablePreventScroll
        >
            {/* 모바일 앱 셸(max-w-md)과 폭을 맞춘다 — vaul은 body에 포탈되므로 여기서 직접 제약 */}
            <DrawerContent
                className="mx-auto max-w-md max-h-[90vh]"
                // modal=false라 vaul이 바깥 클릭에도 기본으로는 안 닫음(의도적) —
                // 지도를 포함해 시트 밖 어디를 클릭해도 닫히길 원하므로 직접 연결.
                onPointerDownOutside={() => onOpenChange(false)}
            >
                <DrawerTitle className="sr-only">Where to?</DrawerTitle>
                <DrawerDescription className="sr-only">
                    Search a destination or pick a nearby stop
                </DrawerDescription>

                {/* pb: Footer가 이제 Drawer보다 z-index가 높아 항상 위에 떠서,
                    마지막 항목이 그 밑에 가려지지 않게 여유를 둠. */}
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
