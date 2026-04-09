'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Landmark,
  Settings,
  Menu,
  X,
  RefreshCw,
  Clock,
  LineChart,
  Target,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/networth', label: 'Net Worth', icon: TrendingUp },
  { href: '/sips', label: 'SIPs', icon: RefreshCw },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/income', label: 'Income', icon: Wallet },
  { href: '/liabilities', label: 'Liabilities', icon: Landmark },
  { href: '/projections', label: 'Projections', icon: LineChart },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden rounded-lg bg-white dark:bg-neutral-900 p-2 shadow-md border border-neutral-200 dark:border-neutral-700"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen w-60 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 pb-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center">
              <span className="text-white dark:text-neutral-900 font-bold text-sm">W</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Worthly</span>
          </Link>
          <p className="text-xs text-neutral-400 mt-1">Financial Independence Planner</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Your data stays local</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">All data stored in your browser</p>
          </div>
        </div>
      </aside>
    </>
  )
}
