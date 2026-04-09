'use client'

import { useState } from 'react'
import { useApp } from '@/context/app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Eye, EyeOff } from 'lucide-react'

export function LockScreen() {
  const { unlock } = useApp()
  const [passkey, setPasskey] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPasskey, setShowPasskey] = useState(false)
  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!passkey) return
    setLoading(true)
    setError(false)
    const ok = await unlock(passkey)
    if (!ok) {
      setError(true)
      setPasskey('')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-neutral-950">
      <div className="w-full max-w-xs mx-4 text-center">
        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center">
          <Lock className="h-6 w-6 text-white dark:text-neutral-900" />
        </div>
        <h1 className="text-xl font-bold mb-1">Worthly</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Enter your passkey to continue</p>

        <form onSubmit={handleUnlock} className="space-y-3">
          <div className="relative">
            <Input
              type={showPasskey ? 'text' : 'password'}
              value={passkey}
              onChange={e => { setPasskey(e.target.value); setError(false) }}
              placeholder="Enter passkey"
              autoFocus
              className={error ? 'border-red-300 focus-visible:ring-red-400 pr-10' : 'pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPasskey(!showPasskey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">Incorrect passkey. Try again.</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !passkey}>
            {loading ? 'Checking...' : 'Unlock'}
          </Button>
        </form>

        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-6">
          Your data is stored locally in this browser
        </p>
      </div>
    </div>
  )
}
