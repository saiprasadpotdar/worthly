'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { db } from '@/lib/db'

const INACTIVITY_TIMEOUT = 2 * 60 * 1000 // 2 minutes

type Theme = 'light' | 'dark' | 'system'

interface AppContextValue {
  masked: boolean
  toggleMask: () => void
  unlocked: boolean
  unlock: (passkey: string) => Promise<boolean>
  hasPasskey: boolean
  checkingAuth: boolean
  theme: Theme
  setTheme: (t: Theme) => void
  isDark: boolean
}

const AppContext = createContext<AppContextValue>({
  masked: false,
  toggleMask: () => {},
  unlocked: true,
  unlock: async () => true,
  hasPasskey: false,
  checkingAuth: true,
  theme: 'system',
  setTheme: () => {},
  isDark: false,
})

export function useApp() {
  return useContext(AppContext)
}

// Simple hash for passkey (not crypto-grade, but fine for local-only app lock)
async function hashPasskey(passkey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(passkey + 'worthly-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export { hashPasskey }

function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('worthly-theme') as Theme) || 'system'
    }
    return 'system'
  })

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('worthly-theme', t)
  }, [])

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  return { theme, setTheme, isDark }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [masked, setMasked] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('worthly-masked') === 'true'
    }
    return false
  })
  const [unlocked, setUnlocked] = useState(false)
  const [hasPasskey, setHasPasskey] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { theme, setTheme, isDark } = useTheme()

  // Check if passkey exists and if session is already unlocked
  useEffect(() => {
    async function check() {
      try {
        const profile = await db.userProfile.toCollection().first()
        const storedHash = (profile as any)?.passkey as string | undefined
        if (storedHash) {
          setHasPasskey(true)
          const sessionUnlocked = sessionStorage.getItem('worthly-unlocked')
          if (sessionUnlocked === 'true') {
            setUnlocked(true)
          }
        } else {
          setHasPasskey(false)
          setUnlocked(true)
        }
      } catch {
        setUnlocked(true)
      } finally {
        setCheckingAuth(false)
      }
    }
    check()
  }, [])

  // Inactivity auto-lock
  const lockApp = useCallback(() => {
    setUnlocked(false)
    sessionStorage.removeItem('worthly-unlocked')
  }, [])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(lockApp, INACTIVITY_TIMEOUT)
  }, [lockApp])

  useEffect(() => {
    if (!hasPasskey || !unlocked) return

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }))

    // Start the timer
    resetTimer()

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [hasPasskey, unlocked, resetTimer])

  const toggleMask = useCallback(() => {
    setMasked(m => {
      const next = !m
      localStorage.setItem('worthly-masked', String(next))
      return next
    })
  }, [])

  const unlock = useCallback(async (passkey: string): Promise<boolean> => {
    try {
      const profile = await db.userProfile.toCollection().first()
      const storedHash = (profile as any)?.passkey as string | undefined
      if (!storedHash) {
        setUnlocked(true)
        return true
      }
      const inputHash = await hashPasskey(passkey)
      if (inputHash === storedHash) {
        setUnlocked(true)
        sessionStorage.setItem('worthly-unlocked', 'true')
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  return (
    <AppContext.Provider value={{ masked, toggleMask, unlocked, unlock, hasPasskey, checkingAuth, theme, setTheme, isDark }}>
      {children}
    </AppContext.Provider>
  )
}
