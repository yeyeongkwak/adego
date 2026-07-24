// Sheet behind the clock icon next to "Leave now"
// Lets the user switch between "depart at" / "arrive by" and pick a time for it, or jump back to

'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { TimeOption } from '@/types/common'
import { Button } from '@/components/ui/button'
import {
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils/utils'

interface TimePickerSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    value: TimeOption
    onApply: (value: TimeOption) => void
}

function timeInputToIso(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.toISOString()
}

function isoToTimeInput(iso: string): string {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TimePickerSheet({
    open,
    onOpenChange,
    value,
    onApply,
}: TimePickerSheetProps) {
    const [mode, setMode] = useState<TimeOption['mode']>(value.mode)
    const [timeInput, setTimeInput] = useState(() =>
        value.time === 'now'
            ? isoToTimeInput(new Date().toISOString())
            : isoToTimeInput(value.time)
    )

    const [prevOpen, setPrevOpen] = useState(open)
    if (open !== prevOpen) {
        setPrevOpen(open)
        if (open) {
            setMode(value.mode)
            setTimeInput(
                value.time === 'now'
                    ? isoToTimeInput(new Date().toISOString())
                    : isoToTimeInput(value.time)
            )
        }
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange} dismissible>
            <DrawerContent className="mx-auto max-w-md">
                <DrawerHeader>
                    <DrawerTitle>Choose a time</DrawerTitle>
                </DrawerHeader>

                <div className="space-y-4 px-4">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setMode('depart')}
                            className={cn(
                                'flex-1 rounded-full py-2 text-sm font-semibold transition-colors',
                                mode === 'depart'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-100 text-gray-600'
                            )}
                        >
                            Depart at
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('arrive')}
                            className={cn(
                                'flex-1 rounded-full py-2 text-sm font-semibold transition-colors',
                                mode === 'arrive'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-100 text-gray-600'
                            )}
                        >
                            Arrive by
                        </button>
                    </div>

                    <div className="relative">
                        <input
                            type="time"
                            value={timeInput}
                            onChange={(e) => setTimeInput(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-2xl font-bold tabular-nums text-primary [&::-webkit-calendar-picker-indicator]:opacity-0"
                        />
                        <Clock className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-primary" />
                    </div>
                </div>

                <DrawerFooter className="gap-6">
                    <Button
                        onClick={() => {
                            onApply({ mode, time: timeInputToIso(timeInput) })
                            onOpenChange(false)
                        }}
                    >
                        Apply
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            onApply({ mode: 'depart', time: 'now' })
                            onOpenChange(false)
                        }}
                    >
                        Leave now
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}
