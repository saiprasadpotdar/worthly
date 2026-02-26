'use client'
import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'

export function useLiveQuery<T>(querier: () => Promise<T> | T, deps: unknown[] = [], defaultValue?: T): T | undefined {
  const [result, setResult] = useState<T | undefined>(defaultValue)

  useEffect(() => {
    const subscription = liveQuery(querier).subscribe({
      next: (value) => setResult(value),
      error: (err) => console.error('LiveQuery error:', err),
    })
    return () => subscription.unsubscribe()
  }, deps)

  return result
}
