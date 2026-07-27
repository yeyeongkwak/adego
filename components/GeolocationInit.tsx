'use client'

import { useEffect } from 'react'
import { useGeolocationStore } from '@/store/geolocationStore'

export function GeolocationInit() {
    const init = useGeolocationStore((s) => s.init)
    useEffect(() => {
        init()
    }, [init])
    return null
}
