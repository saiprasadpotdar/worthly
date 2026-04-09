'use client'
import { cn } from "@/lib/utils"
import { useEffect } from "react"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  title?: string
}

export function Dialog({ open, onClose, children, className, title }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={cn(
          "relative rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg p-0 max-w-lg w-full mx-4",
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
