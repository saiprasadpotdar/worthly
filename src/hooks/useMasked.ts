'use client'

import { useCallback } from 'react'
import { useApp } from '@/context/app-context'
import { formatCurrency, MASKED_AMOUNT } from '@/lib/utils'

/**
 * Returns a version of formatCurrency that respects the mask toggle.
 * Percentages are never masked.
 */
export function useMasked() {
  const { masked } = useApp()

  const fmt = useCallback(
    (value: number, compact = false): string => {
      if (masked) return MASKED_AMOUNT
      return formatCurrency(value, compact)
    },
    [masked]
  )

  return { masked, fmt }
}
