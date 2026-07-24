export function clockTimeFromMinutes(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Adelaide',
    })
}

const CLOCK_THRESHOLD_MIN = 30

export function arrivalTimeLabel(minutesUntil: number): string {
    if (minutesUntil > CLOCK_THRESHOLD_MIN) {
        return clockTimeFromMinutes(minutesUntil)
    }
    return minutesUntil <= 0 ? 'Due' : `${minutesUntil} min`
}
