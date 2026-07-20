// Debounced place autocomplete. Calls /api/autocomplete as the user types
// (waits ~250ms after they stop) and returns predictions.

'use client'

import { useState, useEffect } from 'react'
import { Prediction } from '@/types/common'

export function useAutocomplete(query: string) {
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [loading, setLoading] = useState(false)
    const [sessionToken, setSessionToken] = useState<string | null>(null)
    const q = query.trim()

    // One token per search session: created when typing starts, reused for
    // every debounced autocomplete call, then handed to the Place Details
    // lookup that closes the session. That's what makes Google bill the
    // whole search-and-select as one session instead of N separate requests.

    const [prevQ, setPrevQ] = useState(q)
    if (q !== prevQ) {
        setPrevQ(q)
        if (q && !prevQ) setSessionToken(crypto.randomUUID())
        if (!q) setSessionToken(null)
    }

    useEffect(() => {
        if (!q) return

        const controller = new AbortController()

        // Debounce: wait 250ms after the last keystroke before calling Google.
        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetch(
                    `/api/autocomplete?q=${encodeURIComponent(q)}&sessionToken=${sessionToken}`,
                    {
                        signal: controller.signal,
                    }
                )
                const data = await res.json()
                setPredictions(data.predictions ?? [])
            } catch (e: any) {
                if (e.name !== 'AbortError') setPredictions([])
            } finally {
                setLoading(false)
            }
        }, 250)

        // Cancel both the timer and any in-flight request when the query changes.
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [q, sessionToken])

    return {
        predictions: q ? predictions : [],
        loading,
        sessionToken,
        endSession: () => setSessionToken(null),
    }
}
