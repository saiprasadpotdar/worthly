import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200',
    success: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400',
    warning: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
    danger: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400',
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)} {...props} />
  )
}
