'use client'

import { useCallback, useEffect, useState } from 'react'
import { APIProvider, Map } from '@vis.gl/react-google-maps'
import type { MapEvent } from '@vis.gl/react-google-maps'
import { ArrowLeft, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SelectedPlace } from '@/types/common'

// Adelaide Center(CBD) — same fallback used on /home.
const ADELAIDE = { lat: -34.9285, lng: 138.6007 }

interface MapPickerSheetProps {
    isOpen: boolean
    onClose: () => void
    onLocationSelect: (place: SelectedPlace) => void
    initialCenter?: { lat: number; lng: number } | null
}

export function MapPickerSheet({
    isOpen,
    onClose,
    onLocationSelect,
    initialCenter,
}: MapPickerSheetProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    const [center, setCenter] = useState(initialCenter ?? ADELAIDE)
    const [loading, setLoading] = useState(false)
    const [resolved, setResolved] = useState<{
        label: string
        address: string | null
    } | null>(null)

    // Re-seed the pin whenever the sheet is (re)opened, same "reset state
    // when a prop changes" pattern used elsewhere (RouteDetailSheet, etc.).
    const [prevOpen, setPrevOpen] = useState(isOpen)
    if (isOpen !== prevOpen) {
        setPrevOpen(isOpen)
        if (isOpen) {
            setCenter(initialCenter ?? ADELAIDE)
            setResolved(null)
        }
    }

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
        ;(async () => {
            if (!cancelled) setLoading(true)
            try {
                const res = await fetch(
                    `/api/reverse-geocode?lat=${center.lat}&lng=${center.lng}`
                )
                const data = await res.json()
                if (cancelled) return
                setResolved({
                    label: data.placeName ?? data.address ?? 'Dropped pin',
                    address: data.placeName ? data.address : null,
                })
            } catch {
                if (!cancelled) {
                    setResolved({ label: 'Dropped pin', address: null })
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [center, isOpen])

    const handleIdle = useCallback((e: MapEvent) => {
        const c = e.map.getCenter()
        if (c) setCenter({ lat: c.lat(), lng: c.lng() })
    }, [])

    const handleConfirm = () => {
        if (!resolved) return
        onLocationSelect({
            label: resolved.label,
            address: resolved.address ?? undefined,
            lat: center.lat,
            lng: center.lng,
        })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[75] mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-gray-50">
            <div className="flex items-center gap-3 bg-[#002D62] px-4 py-4 text-white shadow-md">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white hover:bg-white/90 hover:text-[#002D62]"
                >
                    <ArrowLeft className="size-5" />
                </Button>
                <h1 className="text-lg font-semibold tracking-tight">
                    Choose on map
                </h1>
            </div>

            <div className="relative flex-1">
                {!apiKey ? (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
                        Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                    </div>
                ) : (
                    <APIProvider apiKey={apiKey}>
                        <Map
                            className="h-full w-full"
                            defaultCenter={center}
                            defaultZoom={16}
                            disableDefaultUI
                            gestureHandling="greedy"
                            onIdle={handleIdle}
                        />
                    </APIProvider>
                )}

                <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
                    <MapPin
                        className="size-9 text-accent drop-shadow-md"
                        fill="currentColor"
                    />
                </div>
            </div>

            <div className="shrink-0 border-t bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                <div className="mb-3 flex min-h-10 items-center gap-2">
                    {loading || !resolved ? (
                        <>
                            <Loader2 className="size-4 shrink-0 animate-spin text-gray-400" />
                            <span className="text-sm text-gray-500">
                                Finding this location…
                            </span>
                        </>
                    ) : (
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                                {resolved.label}
                            </p>
                            {resolved.address && (
                                <p className="truncate text-xs text-gray-500">
                                    {resolved.address}
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <Button
                    className="w-full rounded-full"
                    onClick={handleConfirm}
                    disabled={loading || !resolved}
                >
                    Select this location
                </Button>
            </div>
        </div>
    )
}
