const ADELAIDE_TZ = 'Australia/Adelaide'

export type DayColumn =
    | 'sunday'
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'

export type AdelaideParts = {
    dateStr: string // "YYYY-MM-DD"
    dayColumn: DayColumn
    secondsSinceMidnight: number
}

export function adelaideParts(referenceMs: number): AdelaideParts {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: ADELAIDE_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(new Date(referenceMs))
    const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? ''
    const getNum = (type: string) => Number(get(type))

    return {
        dateStr: `${get('year')}-${get('month')}-${get('day')}`,
        dayColumn: get('weekday').toLowerCase() as DayColumn,
        secondsSinceMidnight:
            getNum('hour') * 3600 + getNum('minute') * 60 + getNum('second'),
    }
}

export function adelaideSecondsSinceMidnight(referenceMs: number): number {
    return adelaideParts(referenceMs).secondsSinceMidnight
}

export function adelaideServiceDay(referenceMs: number): {
    dateStr: string
    dayColumn: DayColumn
} {
    const { dateStr, dayColumn } = adelaideParts(referenceMs)
    return { dateStr, dayColumn }
}

export function scheduledTimeToMs(hhmmss: string, referenceMs: number): number {
    const midnightMs =
        referenceMs - adelaideSecondsSinceMidnight(referenceMs) * 1000
    const [h, m, s] = hhmmss.split(':').map(Number)
    return midnightMs + (h * 3600 + m * 60 + s) * 1000
}

export function gtfsTimeString(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = Math.floor(totalSeconds % 60)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}`
}
