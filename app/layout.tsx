import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ReactNode } from 'react'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

export const metadata: Metadata = {
    title: {
        default: 'Adego Beep',
        template: '%s | Adego Beep',
    },
    description:
        'Accurate real-time bus arrivals for Adelaide public transport',
    applicationName: 'Adego Beep',
    appleWebApp: {
        capable: true,
        title: 'Adego Beep',
        statusBarStyle: 'default',
    },
}

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode
}>) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col">
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
