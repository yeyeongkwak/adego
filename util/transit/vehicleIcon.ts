import { BusFront, TrainFront, TramFront } from 'lucide-react'
import type { StopMode } from '@/types/common'

// Vehicle type -> icon (same set used for map markers/nearby stops)
export function vehicleIcon(type?: string): typeof BusFront {
    switch (type) {
        case 'TRAM':
            return TramFront
        case 'HEAVY_RAIL':
        case 'RAIL':
        case 'SUBWAY':
            return TrainFront
        default:
            return BusFront
    }
}

// Google's TransitVehicleType string -> our StopMode, so Google-sourced
// vehicle types can reuse the same STOP_ICON_URL map markers do.
export function vehicleTypeToStopMode(type?: string): StopMode {
    switch (type) {
        case 'TRAM':
            return 'TRAM'
        case 'HEAVY_RAIL':
        case 'RAIL':
        case 'SUBWAY':
            return 'RAIL'
        default:
            return 'BUS'
    }
}

// Display word per mode — "Bus 801", "Tram J1", "Train Belair".
export const VEHICLE_LABEL: Record<StopMode, string> = {
    BUS: 'Bus',
    TRAM: 'Tram',
    RAIL: 'Train',
}
