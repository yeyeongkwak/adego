export function formatDurationText(sec: number): string {
    const mins = Math.round(sec / 60)
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m === 0 ? `${h} hr${h === 1 ? '' : 's'}` : `${h} hr ${m} min`
}
