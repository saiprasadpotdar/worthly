import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  indicatorClassName?: string
}

export function Progress({ value, max = 100, className, indicatorClassName, ...props }: ProgressProps) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className={cn("relative h-3 w-full overflow-hidden rounded-full bg-neutral-100", className)} {...props}>
      <div
        className={cn("h-full rounded-full bg-neutral-900 transition-all duration-500", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
