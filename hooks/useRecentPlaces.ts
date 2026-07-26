// Recently selected places, persisted to localStorage — same guest-only
// stand-in pattern as useFavoritePlaces/useFavoriteStops (no member
// accounts/DB yet). Most-recent-first, capped, deduped by the same
// placeId-or-label rule favourites use so picking the same place again just
// bumps it to the top instead of listing it twice.

'use client'

import { useEffect, useState } from 'react'
import type { SelectedPlace } from '@/types/common'

const STORAGE_KEY = 'recentPlaces'
const MAX_RECENTS = 8

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

export function useRecentPlaces() {
    const [recents, setRecents] = useState<SelectedPlace[]>([])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage (an external system) on mount; starting empty avoids a hydration mismatch since localStorage isn't available during SSR
        setRecents(readStored())
    }, [])

    const addRecent = (place: SelectedPlace) => {
        setRecents((prev) => {
            const next = [
                place,
                ...prev.filter((p) => !samePlace(p, place)),
            ].slice(0, MAX_RECENTS)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            return next
        })
    }

    return { recents, addRecent }
}
