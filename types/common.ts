// =====================================================================
// types/index.ts  (cleaned up)
// Core principle: the leg array (IRouteOption) is the source of truth for route data.
//   → It covers transfers (bus + tram) and multi-modal trips.
//   → Flat values the card needs (bus number, etc.) are derived from legs (see helpers below).
// =====================================================================

// ---- Which field is being edited: origin or destination -------------
export enum RouteSearchType {
    ORIGIN = 'ORIGIN',
    DESTINATION = 'DESTINATION',
}

// ---- Selected place (coordinates required) --------------------------
export type SelectedPlace = {
    label: string // Display name: "Current location", "Woolworths"
    address?: string // Address (from favorites, etc.)
    lat: number // NOTE: always number — mixing in strings causes calculation bugs
    lng: number
}

// ---- A single leg of a route — one Google step ----------------------
export interface ILeg {
    mode: 'WALKING' | 'TRANSIT'
    durationText: string // "12 mins"
    durationSec: number
    // Only populated when mode is TRANSIT ↓
    routeName?: string // "801" / "Glenelg" — realtime matching key + display label
    routeColor?: string // "#RRGGBB"
    vehicleType?: string // BUS / TRAM / TRAIN — used for the icon
    departureStopName?: string
    arrivalStopName?: string
    numStops?: number
    departureIn?: string | null // Realtime (GTFS-R). null at the Google step, filled in later
}

// ---- One route option = One card -----
export interface IRouteOption {
    durationText: string // "23 mins"  (total duration)
    durationSec: number // From Google's route.duration the sorting key for "Fastest"
    departureText?: string // "4:51 PM"
    departureValue?: number // Unix seconds
    arrivalText?: string // "5:40 PM"
    legs: ILeg[] // Walking, bus, and transfers all included
}

// ---- API response shape (returned by route.ts) ----------------------
export interface DirectionsResponse {
    options: IRouteOption[]
}

// ---- Filtering / Sorting in the UI ----------------------------------
export enum RouteTypes {
    FASTEST,
    LEAST_TRANSFER,
}

export type TimeOption =
    { mode: 'depart'; time: string } | { mode: 'arrive'; time: string }

// =====================================================================
// UI helpers: derive the flat values a card needs from the leg array
//   (replaces the old RouteOption's busNumber/walkDuration/stopInfo fields)
// =====================================================================

// First transit leg (the bus/tram the user needs to catch right now)
export function firstTransitLeg(option: IRouteOption): ILeg | undefined {
    return option.legs.find((l) => l.mode === 'TRANSIT')
}

// First walking leg (walk to the stop)
export function firstWalkLeg(option: IRouteOption): ILeg | undefined {
    return option.legs.find((l) => l.mode === 'WALKING')
}

// Transfer count = number of transit legs - 1
export function transferCount(option: IRouteOption): number {
    const transit = option.legs.filter((l) => l.mode === 'TRANSIT').length
    return Math.max(0, transit - 1)
}

// =====================================================================
// Component props
// =====================================================================
export interface RouteListScreenProps {
    isAuthenticated: boolean
    onBack: () => void
    onLoginClick: () => void
}

export type Prediction = {
    placeId: string
    mainText: string // "Glenelg"
    secondaryText: string // "SA, Australia"
}

export function textOnColor(hex?: string): string {
    if (!hex) return '#FFFFFF'
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.6 ? '#1F2937' : '#FFFFFF'
}

export type StopMode = 'BUS' | 'TRAM' | 'RAIL'

// ---- Nearby stops (/api/stops-nearby response) ----------------------
export type NearbyStop = {
    id: string // gtfs stop_id
    code: string | null // stop_code ("18713")
    name: string // "Currie St"
    lat: number
    lng: number
    distanceM?: number // Distance from the current location, in meters — only meaningful for a location-based lookup (e.g. /api/stops-nearby), not a name search
    mode: StopMode
}

export function stopModeFromRouteType(routeType: number | null): StopMode {
    if (routeType == null) return 'BUS'
    if (
        routeType === 0 ||
        routeType === 5 ||
        (routeType >= 900 && routeType < 1000)
    ) {
        return 'TRAM'
    }
    if (
        routeType === 1 ||
        routeType === 2 ||
        (routeType >= 100 && routeType < 200) ||
        (routeType >= 400 && routeType < 500)
    ) {
        return 'RAIL'
    }
    return 'BUS'
}

export type Arrival = {
    stopName: string
    routeName: string
    minutesUntil: number | null // null = no realtime data for this pair
    delaySeconds: number | null // + late, - early, 0 on time
    isRealtime: boolean
    tripId: string | null // GTFS-R trip_id of the matched vehicle, for /api/vehicle-position
}

// Live GPS fix for one vehicle (/api/vehicle-position response).
export type VehiclePosition = {
    lat: number
    lng: number
    bearing: number | null // degrees, 0 = north; null if the vehicle doesn't report it
    updatedAtSec: number // unix seconds, from the feed's own timestamp
}

// One upcoming departure — either a live GTFS-R match or a scheduled-only fallback from the static timetable.
export type StopArrivalTime = {
    minutesUntil: number
    delaySeconds: number
    isRealtime: boolean
}

export type StopArrival = {
    routeName: string
    routeColor: string | null // "#RRGGBB" from gtfs_routes, null if unset
    times: StopArrivalTime[]
}

export const TRIP_UPDATES_URL =
    'https://gtfs.adelaidemetro.com.au/v1/realtime/trip_updates'

export const VEHICLE_POSITIONS_URL =
    'https://gtfs.adelaidemetro.com.au/v1/realtime/vehicle_positions'
