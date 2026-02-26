import type { Metadata } from "next"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"

export const metadata: Metadata = {
  title: "Worthly - Financial Independence Planner",
  description: "Track your assets, liabilities, and financial independence journey. Your data, your control.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Sidebar />
        <main className="md:ml-60 min-h-screen">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
