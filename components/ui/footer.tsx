'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BusFront, Home, Star, Route, Settings } from 'lucide-react'

export type NavTab = 'home' | 'favorite' | 'routePlan' | 'stops'
// | 'settings'

const items: {
    id: NavTab
    label: string
    icon: typeof Home
    href: string
}[] = [
    { id: 'home', label: 'Home', icon: Home, href: '/home' },
    { id: 'favorite', label: 'Favorite', icon: Star, href: '/favorite' },
    { id: 'routePlan', label: 'Route Plan', icon: Route, href: '/route' },
    { id: 'stops', label: 'Stops', icon: BusFront, href: '/stops' },
    // { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
]

export function Footer() {
    const pathname = usePathname()

    return (
        // z-[60]: vaul Drawer(HomeSheet)가 document.body에 포탈되어 fixed z-50으로
        // 뷰포트 맨 아래까지 깔리는데, Footer는 그 위에 항상 보여야 하므로 더 높게.
        <nav className="sticky bottom-0 z-[60] w-full bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
            <div className="grid grid-cols-4">
                {items.map(({ id, label, icon: Icon, href }) => {
                    const isActive =
                        pathname === href || pathname.startsWith(`${href}/`)
                    return (
                        <Link
                            key={id}
                            href={href}
                            className="flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
                        >
                            <Icon
                                className={`size-5 ${isActive ? 'text-primary' : 'text-gray-400'}`}
                                fill={
                                    isActive && id === 'favorite'
                                        ? 'currentColor'
                                        : 'none'
                                }
                            />
                            <span
                                className={`text-xs ${isActive ? 'text-primary font-medium' : 'text-gray-400'}`}
                            >
                                {label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
