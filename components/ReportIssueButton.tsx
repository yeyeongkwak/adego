'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2, MessageSquareWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils/utils'

type ReportType = 'bug' | 'suggestion'
type Status = 'idle' | 'sending' | 'sent' | 'error'

export function ReportIssueButton() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const [type, setType] = useState<ReportType>('bug')
    const [message, setMessage] = useState('')
    const [status, setStatus] = useState<Status>('idle')

    const reset = () => {
        setType('bug')
        setMessage('')
        setStatus('idle')
    }

    const handleSubmit = async () => {
        if (!message.trim() || status === 'sending') return
        setStatus('sending')
        try {
            const res = await fetch('/api/report-issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, message, page: pathname }),
            })
            if (!res.ok) throw new Error('failed')
            setStatus('sent')
            setTimeout(() => {
                setOpen(false)
                reset()
            }, 1200)
        } catch {
            setStatus('error')
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Report an issue or suggestion"
                className="absolute right-4 bottom-20 z-[65] flex size-12 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg transition-transform hover:text-primary active:scale-95"
            >
                <MessageSquareWarning className="size-5" />
            </button>

            <Sheet
                open={open}
                onOpenChange={(next) => {
                    setOpen(next)
                    if (!next) reset()
                }}
                modal={false}
            >
                <SheetContent
                    side="bottom"
                    // pb-20: the app Footer sits at a higher z-index than
                    // this sheet (so it stays clickable over full-screen
                    // sheets elsewhere) — without this, the Footer bar
                    // visually covers whatever's at the bottom of this
                    // sheet, e.g. the Send button.
                    className="mx-auto max-w-md rounded-t-2xl border-0 p-4 pb-20"
                >
                    <SheetHeader className="px-0">
                        <SheetTitle>Report an issue</SheetTitle>
                        <SheetDescription>
                            Found a bug, or have an idea to make this better?
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={type === 'bug' ? 'default' : 'outline'}
                            className="flex-1 rounded-full"
                            onClick={() => setType('bug')}
                        >
                            Bug report
                        </Button>
                        <Button
                            type="button"
                            variant={
                                type === 'suggestion' ? 'default' : 'outline'
                            }
                            className="flex-1 rounded-full"
                            onClick={() => setType('suggestion')}
                        >
                            Suggestion
                        </Button>
                    </div>

                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={
                            type === 'bug'
                                ? 'What went wrong?'
                                : 'What should be improved?'
                        }
                        maxLength={1500}
                        className="min-h-32"
                        autoFocus
                    />

                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!message.trim() || status === 'sending'}
                        className={cn(
                            'w-full rounded-full',
                            status === 'sent' && 'bg-green-600 hover:bg-green-600'
                        )}
                    >
                        {status === 'sending' && (
                            <Loader2 className="size-4 animate-spin" />
                        )}
                        {status === 'sent'
                            ? 'Sent — thank you!'
                            : status === 'error'
                              ? 'Failed to send, try again'
                              : 'Send'}
                    </Button>
                </SheetContent>
            </Sheet>
        </>
    )
}
