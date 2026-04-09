'use client'

import { useApp } from '@/context/app-context'
import { Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TopBar() {
  const { masked, toggleMask, theme, setTheme } = useApp()

  function cycleTheme() {
    const order = ['light', 'system', 'dark'] as const
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % order.length])
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <div className="flex items-center justify-end gap-2 px-4 sm:px-6 lg:px-8 py-3 border-b border-neutral-100 dark:border-neutral-800">
      {/* Theme toggle */}
      <button
        onClick={cycleTheme}
        className="flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium transition-all hover:border-neutral-300 dark:hover:border-neutral-600"
        title={`Theme: ${theme}`}
      >
        <ThemeIcon className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
        <span className="text-neutral-500 dark:text-neutral-400 capitalize hidden sm:inline">{theme}</span>
      </button>

      {/* Mask toggle */}
      <button
        onClick={toggleMask}
        className="flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium transition-all hover:border-neutral-300 dark:hover:border-neutral-600"
        title={masked ? 'Show amounts' : 'Hide amounts'}
      >
        <span className="text-neutral-500 dark:text-neutral-400">₹</span>
        {/* Track-style toggle */}
        <div className={cn(
          "relative w-8 h-4 rounded-full transition-colors",
          masked ? "bg-neutral-900 dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"
        )}>
          <div className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white dark:bg-neutral-900 shadow-sm transition-transform",
            masked ? "translate-x-4" : "translate-x-0.5"
          )} />
        </div>
        {masked ? (
          <EyeOff className="h-3.5 w-3.5 text-neutral-900 dark:text-white" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-neutral-400" />
        )}
      </button>
    </div>
  )
}
