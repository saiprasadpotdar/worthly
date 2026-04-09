'use client'
import { useState, useCallback } from 'react'

interface ConfirmState {
  open: boolean
  title: string
  description: string
  variant: 'default' | 'destructive'
  confirmLabel: string
  resolve: ((value: boolean) => void) | null
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    confirmLabel: 'Confirm',
    resolve: null,
  })

  const confirm = useCallback((options: {
    title: string
    description: string
    variant?: 'default' | 'destructive'
    confirmLabel?: string
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title,
        description: options.description,
        variant: options.variant ?? 'default',
        confirmLabel: options.confirmLabel ?? 'Confirm',
        resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(s => ({ ...s, open: false, resolve: null }))
  }, [state.resolve])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(s => ({ ...s, open: false, resolve: null }))
  }, [state.resolve])

  return {
    confirm,
    confirmProps: {
      open: state.open,
      title: state.title,
      description: state.description,
      variant: state.variant,
      confirmLabel: state.confirmLabel,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  }
}
