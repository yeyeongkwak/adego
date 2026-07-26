'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PageHeader({
    title,
    right,
}: {
    title: string
    right?: ReactNode
}) {
    const router = useRouter()
    return (
        <div className="flex items-center gap-3">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="shrink-0 text-white transition-all hover:bg-white/90 hover:text-[#002D62]"
                aria-label="Back"
            >
                <ArrowLeft className="size-5" />
            </Button>
            <h1 className="flex-1 truncate text-xl font-semibold tracking-tight">
                {title}
            </h1>
            {right}
        </div>
    )
}
