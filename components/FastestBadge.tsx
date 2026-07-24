// Small pill straddling the top-left edge of the fastest route card. Pairs
// with a `ring-2 ring-accent` on the card itself
export function FastestBadge() {
    return (
        <span className="absolute top-0 left-4 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black tracking-wider text-accent-foreground uppercase shadow-sm">
            Fastest
        </span>
    )
}
