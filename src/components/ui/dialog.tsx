'use client'
import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  title?: string
}

export function Dialog({ open, onClose, children, className, title }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (open) ref.current?.showModal()
    else ref.current?.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cn(
        "backdrop:bg-black/50 rounded-xl border border-neutral-200 shadow-lg p-0 max-w-lg w-full",
        className
      )}
    >
      <div className="p-6">
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-neutral-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  )
}
