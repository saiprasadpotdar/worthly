'use client'
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"
import { Button } from "./button"

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="relative rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg p-6 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div className={cn(
            "rounded-full p-2 h-fit",
            variant === 'destructive' ? 'bg-red-50 dark:bg-red-950' : 'bg-neutral-100 dark:bg-neutral-800'
          )}>
            <AlertTriangle className={cn(
              "h-4 w-4",
              variant === 'destructive' ? 'text-red-600 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'
            )} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">{title}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
