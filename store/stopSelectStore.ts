import { create } from 'zustand'
import type { NearbyStop } from '@/types/common'

type StopSelectStore = {
    pendingStop: NearbyStop | null
    setPendingStop: (stop: NearbyStop) => void
    consumePendingStop: () => NearbyStop | null
}

export const useStopSelectStore = create<StopSelectStore>((set, get) => ({
    pendingStop: null,
    setPendingStop: (stop) => set({ pendingStop: stop }),
    consumePendingStop: () => {
        const { pendingStop } = get()
        set({ pendingStop: null })
        return pendingStop
    },
}))
