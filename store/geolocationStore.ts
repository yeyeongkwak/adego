import { create } from 'zustand'

export type Coords = { lat: number; lng: number }
type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt'

interface GeolocationStore {
    coords: Coords | null
    permission: PermissionState
    locating: boolean
    initialized: boolean
    enable: () => Promise<boolean>
    init: () => void
}

let watchId: number | null = null

let pendingResolvers: ((ok: boolean) => void)[] = []

const COORDS_STORAGE_KEY = 'adego:lastKnownCoords'

function readCachedCoords(): Coords | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(COORDS_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
            return { lat: parsed.lat, lng: parsed.lng }
        }
    } catch {}
    return null
}

function writeCachedCoords(coords: Coords) {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coords))
    } catch {}
}

function clearActiveWatch() {
    if (watchId != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
    }
    watchId = null
}

function flushPending(ok: boolean) {
    const resolvers = pendingResolvers
    pendingResolvers = []
    resolvers.forEach((resolve) => resolve(ok))
}

export const useGeolocationStore = create<GeolocationStore>((set, get) => ({
    coords: readCachedCoords(),
    permission: 'unknown',
    locating: false,
    initialized: false,

    enable: () =>
        new Promise<boolean>((resolve) => {
            if (!navigator.geolocation) return resolve(false)

            if (watchId != null) {
                if (get().coords != null) {
                    resolve(true)
                } else {
                    pendingResolvers.push(resolve)
                }
                return
            }

            set({ locating: true })
            pendingResolvers.push(resolve)

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    }
                    writeCachedCoords(coords)
                    set({
                        coords,
                        permission: 'granted',
                        locating: false,
                    })
                    flushPending(true)
                },
                (error) => {
                    set({ locating: false })
                    if (error.code === error.PERMISSION_DENIED) {
                        clearActiveWatch()
                    }
                    flushPending(false)
                },
                { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
            )
        }),

    init: () => {
        if (!navigator.permissions) {
            set({ initialized: true })
            get().enable()
            return
        }

        navigator.permissions
            .query({ name: 'geolocation' })
            .then((status) => {
                set({
                    permission: status.state as PermissionState,
                    initialized: true,
                })
                if (status.state === 'granted') get().enable()

                // Reacts if the user flips the permission from OS/browser
                // settings while the app is still open.
                status.onchange = () => {
                    set({ permission: status.state as PermissionState })
                    if (status.state === 'granted') {
                        get().enable()
                    } else {
                        clearActiveWatch()
                        set({ coords: null })
                    }
                }
            })
            .catch(() => {
                set({ initialized: true })
                get().enable()
            })
    },
}))
