import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Plus } from "lucide-react"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({ icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="rounded-full bg-neutral-100 p-4 mb-4">{icon}</div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-neutral-500 mb-4 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {actionLabel}
        </Button>
      )}
    </div>
  )
}
