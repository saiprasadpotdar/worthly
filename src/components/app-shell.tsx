'use client'

import { useEffect } from 'react'
import { AppProvider, useApp } from '@/context/app-context'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { LockScreen } from '@/components/lock-screen'
import { captureSnapshot } from '@/lib/db'
import type { ReactNode } from 'react'

/** Auto-capture a snapshot once per month on app load */
function useAutoSnapshot(unlocked: boolean) {
  useEffect(() => {
    if (!unlocked) return
    const lastKey = 'worthly-last-auto-snapshot'
    const last = localStorage.getItem(lastKey)
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${now.getMonth() + 1}`
    if (last === thisMonth) return // already captured this month
    captureSnapshot().then(() => {
      localStorage.setItem(lastKey, thisMonth)
    }).catch(() => {})
  }, [unlocked])
}

function AppContent({ children }: { children: ReactNode }) {
  const { unlocked, hasPasskey, checkingAuth, isDark } = useApp()
  useAutoSnapshot(unlocked)

  // Toggle dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  // Show nothing while checking auth (prevents flash)
  if (checkingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="h-8 w-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center animate-pulse">
          <span className="text-white dark:text-neutral-900 font-bold text-sm">W</span>
        </div>
      </div>
    )
  }

  // Show lock screen if passkey is set but not yet unlocked
  if (hasPasskey && !unlocked) {
    return <LockScreen />
  }

  return (
    <>
      <Sidebar />
      <main className="md:ml-60 min-h-screen">
        <TopBar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <AppContent>{children}</AppContent>
    </AppProvider>
  )
}
