import React from 'react'
import { Footer } from '@/components/ui/footer'
import { ReportIssueButton } from '@/components/ReportIssueButton'

const HomeLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        // Place the "App Shell" fixed to mobile width (max-w-md) in the center of the screen.
        // It fills the screen on actual devices (phones), and floats in the center like a phone card on desktops.
        // The shell must be given a fixed height of h (dvh) instead of min-h so that the flex-1 of <main>
        // has an actual pixel height, and the h-full chain (map, etc.) inside it is rendered correctly.

        <div className="min-h-dvh bg-gray-200">
            <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col bg-gray-50 shadow-xl">
                <main className="flex-1 overflow-y-auto">{children}</main>
                <Footer />
                <ReportIssueButton />
            </div>
        </div>
    )
}

export default HomeLayout
