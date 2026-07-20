// Small pill straddling the top-left edge of the fastest route card. Pairs
// with a `ring-2 ring-blue-500` on the card itself — needs a `relative`
// container.
export function FastestBadge() {
    return (
        <span className="absolute top-0 left-4 -translate-y-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black tracking-wider text-white uppercase shadow-sm">
            Fastest
        </span>
    )
}
