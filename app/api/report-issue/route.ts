import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type ReportType = 'bug' | 'suggestion'

const EMBED_COLOR: Record<ReportType, number> = {
    bug: 0xd4183d, // red — matches the destination-pin red used elsewhere
    suggestion: 0x2563eb, // blue
}

const EMBED_TITLE: Record<ReportType, string> = {
    bug: '🐛 Bug report',
    suggestion: '💡 Suggestion',
}

// Separate channels per type — falls back to a single shared webhook so
// setup can start with just one env var and split later.
function webhookUrlFor(type: ReportType): string | undefined {
    if (type === 'bug') {
        return (
            process.env.DISCORD_WEBHOOK_URL_BUG ??
            process.env.DISCORD_WEBHOOK_URL
        )
    }
    return (
        process.env.DISCORD_WEBHOOK_URL_SUGGESTION ??
        process.env.DISCORD_WEBHOOK_URL
    )
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    const type: ReportType = body?.type === 'suggestion' ? 'suggestion' : 'bug'

    const webhookUrl = webhookUrlFor(type)
    if (!webhookUrl) {
        return NextResponse.json(
            { error: 'Reporting is not configured.' },
            { status: 503 }
        )
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const page = typeof body?.page === 'string' ? body.page : 'unknown'

    if (!message) {
        return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }
    if (message.length > 1500) {
        return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })
    }

    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            embeds: [
                {
                    title: EMBED_TITLE[type],
                    description: message,
                    color: EMBED_COLOR[type],
                    fields: [{ name: 'Page', value: page, inline: true }],
                    timestamp: new Date().toISOString(),
                },
            ],
        }),
    })

    if (!res.ok) {
        return NextResponse.json(
            { error: 'Failed to deliver report.' },
            { status: 502 }
        )
    }

    return NextResponse.json({ ok: true })
}
