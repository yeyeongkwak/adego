'use client'

import { useEffect, useState } from 'react'
import type { SelectedPlace } from '@/types/common'

const STORAGE_KEY = 'favoritePlaces'

function readStored(): SelectedPlace[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as SelectedPlace[]) : []
    } catch {
        return []
    }
}

function samePlace(a: SelectedPlace, b: SelectedPlace): boolean {
    if (a.placeId && b.placeId) return a.placeId === b.placeId
    return a.label === b.label
}

export function useFavoritePlaces() {
    const [favorites, setFavorites] = useState<SelectedPlace[]>([])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage (an external system) on mount; starting empty avoids a hydration mismatch since localStorage isn't available during SSR
        setFavorites(readStored())
    }, [])

    const isFavorite = (place: SelectedPlace) =>
        favorites.some((f) => samePlace(f, place))

    const toggleFavorite = (place: SelectedPlace) => {
        setFavorites((prev) => {
            const next = prev.some((f) => samePlace(f, place))
                ? prev.filter((f) => !samePlace(f, place))
                : [...prev, place]
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            return next
        })
    }

    return { favorites, isFavorite, toggleFavorite }
}
