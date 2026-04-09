import type { Metadata } from "next"
import "./globals.css"
import { AppShell } from "@/components/app-shell"

export const metadata: Metadata = {
  title: "Worthly - Financial Independence Planner",
  description: "Track your assets, liabilities, and financial independence journey. Your data, your control.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
