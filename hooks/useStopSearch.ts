'use client'

import { useEffect, useState } from 'react'
import type { NearbyStop } from '@/types/common'

export function useStopSearch(query: string) {
    const [stops, setStops] = useState<NearbyStop[]>([])
    const [loading, setLoading] = useState(false)
    const q = query.trim()

    useEffect(() => {
        if (!q) return

        const controller = new AbortController()

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetch(
                    `/api/stops-search?query=${encodeURIComponent(q)}`,
                    { signal: controller.signal }
                )
                const data = await res.json()
                setStops(data.stops ?? [])
            } catch (e: any) {
                if (e.name !== 'AbortError') setStops([])
            } finally {
                setLoading(false)
            }
        }, 250)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [q])

    return { stops: q ? stops : [], loading }
}
