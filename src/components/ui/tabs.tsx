'use client'
import { cn } from "@/lib/utils"
import { createContext, useContext, useState } from "react"

const TabsContext = createContext<{ value: string; onChange: (v: string) => void }>({ value: '', onChange: () => {} })

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) {
  const [value, setValue] = useState(defaultValue)
  return (
    <TabsContext.Provider value={{ value, onChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg bg-neutral-100 p-1", className)}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)
  return (
    <button
      onClick={() => ctx.onChange(value)}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        ctx.value === value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900",
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}
