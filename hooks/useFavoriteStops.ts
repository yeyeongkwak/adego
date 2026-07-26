'use client'

import { useSyncExternalStore } from 'react'
import type { NearbyStop } from '@/types/common'

const STORAGE_KEY = 'favoriteStops'

const listeners = new Set<() => void>()
let cached: NearbyStop[] | null = null

function readStored(): NearbyStop[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as NearbyStop[]) : []
    } catch {
        return []
    }
}

function getSnapshot(): NearbyStop[] {
    if (cached === null) cached = readStored()
    return cached
}

function getServerSnapshot(): NearbyStop[] {
    return []
}

function subscribe(onStoreChange: () => void): () => void {
    listeners.add(onStoreChange)
    return () => listeners.delete(onStoreChange)
}

function writeStored(next: NearbyStop[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    cached = next
    listeners.forEach((listener) => listener())
}

export function useFavoriteStops() {
    const favorites = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    )

    const isFavorite = (stopId: string) =>
        favorites.some((s) => s.id === stopId)

    const toggleFavorite = (stop: NearbyStop) => {
        const next = favorites.some((s) => s.id === stop.id)
            ? favorites.filter((s) => s.id !== stop.id)
            : [...favorites, stop]
        writeStored(next)
    }

    return { favorites, isFavorite, toggleFavorite }
}
