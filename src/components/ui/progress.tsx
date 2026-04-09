import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  indicatorClassName?: string
}

export function Progress({ value, max = 100, className, indicatorClassName, ...props }: ProgressProps) {
  const safeValue = Number.isFinite(value) ? value : 0
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100
  const pct = Math.max(0, Math.min((safeValue / safeMax) * 100, 100))
  return (
    <div className={cn("relative h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800", className)} {...props}>
      <div
        className={cn("h-full rounded-full bg-neutral-900 dark:bg-white transition-all duration-500", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
