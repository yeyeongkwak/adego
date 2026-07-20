// One-shot handoff for "picked a destination on /home, jump to /route
// with it already filled in". Zustand state survives client-side
// navigation (same JS session), which is all this needs — no URL params
// or persistence required since it's consumed once and cleared.

import { create } from 'zustand'
import type { SelectedPlace } from '@/types/common'

type RouteSearchStore = {
    pendingOrigin: SelectedPlace | null
    pendingDestination: SelectedPlace | null
    setPendingSearch: (
        origin: SelectedPlace | null,
        destination: SelectedPlace | null
    ) => void
    // Read-and-clear so a manual visit to /route later doesn't replay stale data.
    consumePendingSearch: () => {
        origin: SelectedPlace | null
        destination: SelectedPlace | null
    }
}

export const useRouteSearchStore = create<RouteSearchStore>((set, get) => ({
    pendingOrigin: null,
    pendingDestination: null,
    setPendingSearch: (origin, destination) =>
        set({ pendingOrigin: origin, pendingDestination: destination }),
    consumePendingSearch: () => {
        const { pendingOrigin, pendingDestination } = get()
        set({ pendingOrigin: null, pendingDestination: null })
        return { origin: pendingOrigin, destination: pendingDestination }
    },
}))
