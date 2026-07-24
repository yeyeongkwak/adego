const ADELAIDE_TZ = 'Australia/Adelaide'

export function scheduledTimeToMs(hhmmss: string, referenceMs: number): number {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: ADELAIDE_TZ,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(new Date(referenceMs))
    const get = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value ?? 0)
    const localMsOfDay =
        (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000
    const midnightMs = referenceMs - localMsOfDay

    const [h, m, s] = hhmmss.split(':').map(Number)
    return midnightMs + (h * 3600 + m * 60 + s) * 1000
}

export type DayColumn =
    | 'sunday'
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'

export function adelaideServiceDay(referenceMs: number): {
    dateStr: string
    dayColumn: DayColumn
} {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: ADELAIDE_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
    }).formatToParts(new Date(referenceMs))
    const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? ''
    const dateStr = `${get('year')}-${get('month')}-${get('day')}`
    const dayColumn = get('weekday').toLowerCase() as DayColumn
    return { dateStr, dayColumn }
}
