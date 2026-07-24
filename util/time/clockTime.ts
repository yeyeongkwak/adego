// "X minutes from now" -> a wall-clock time string ("11:42 PM"), in Adelaide
// local time (the app has no multi-timezone handling anywhere — see
// route/page.tsx). Used wherever a countdown would otherwise show an
// unreadably large minute count (e.g. a scheduled-only arrival hours away).
export function clockTimeFromMinutes(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toLocaleTimeString(
        'en-AU',
        {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Australia/Adelaide',
        }
    )
}

// Past this many minutes out, a countdown stops being useful at a glance
// (a live-tracked bus can still have a valid prediction an hour out) -> show
// the clock time instead, regardless of whether the source is realtime or
// scheduled.
const CLOCK_THRESHOLD_MIN = 30

export function arrivalTimeLabel(minutesUntil: number): string {
    if (minutesUntil > CLOCK_THRESHOLD_MIN) {
        return clockTimeFromMinutes(minutesUntil)
    }
    return minutesUntil <= 0 ? 'Due' : `${minutesUntil} min`
}
