'use client'

import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  formattedValue?: string
  delta?: string
  deltaColor?: 'green' | 'red' | 'neutral'
  /** Optional base value to show as a tick mark on the track (for "reset to base" reference). */
  baseValue?: number
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, formattedValue, delta, deltaColor = 'neutral', baseValue, min, max, ...props }, ref) => {
    const deltaColors = {
      green: 'text-emerald-600 dark:text-emerald-400',
      red: 'text-red-600 dark:text-red-400',
      neutral: 'text-neutral-500 dark:text-neutral-400',
    }

    const minNum = typeof min === 'number' ? min : Number(min ?? 0)
    const maxNum = typeof max === 'number' ? max : Number(max ?? 100)
    const basePct =
      baseValue !== undefined && isFinite(baseValue) && maxNum > minNum
        ? Math.max(0, Math.min(100, ((baseValue - minNum) / (maxNum - minNum)) * 100))
        : null

    return (
      <div className="space-y-1.5">
        {(label || formattedValue) && (
          <div className="flex items-center justify-between">
            {label && <span className="text-sm font-medium">{label}</span>}
            <div className="flex items-center gap-2">
              {formattedValue && <span className="text-sm font-semibold">{formattedValue}</span>}
              {delta && <span className={cn("text-xs font-medium", deltaColors[deltaColor])}>{delta}</span>}
            </div>
          </div>
        )}
        <div className="relative">
          <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            className={cn(
              "w-full h-2 rounded-full appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700",
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-900 dark:[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm",
              "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-neutral-900 dark:[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0",
              className
            )}
            {...props}
          />
          {basePct !== null && (
            <div
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-3 w-0.5 rounded-full bg-neutral-500 dark:bg-neutral-400 opacity-70"
              style={{ left: `calc(${basePct}% - 1px)` }}
              aria-hidden
              title="Base value"
            />
          )}
        </div>
      </div>
    )
  }
)
Slider.displayName = "Slider"
