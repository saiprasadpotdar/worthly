'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useMasked } from '@/hooks/useMasked'
import { useApp } from '@/context/app-context'
import { db, captureSnapshot, seedDefaultMilestones } from '@/lib/db'
import { formatPercent, getChartColors } from '@/lib/utils'
import { calculateLeanFI, calculateRegularFI, calculateFatFI } from '@/lib/calculations/fi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useConfirm } from '@/hooks/useConfirm'
import { Camera, TrendingUp, Trophy, Trash2, Target } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function TimelinePage() {
  const { fmt } = useMasked()
  const { isDark } = useApp()
  const colors = getChartColors(isDark)
  const profile = useLiveQuery(() => db.userProfile.toCollection().first(), [])
  const snapshots = useLiveQuery(() => db.netWorthSnapshots.orderBy('date').toArray(), [])
  const milestones = useLiveQuery(() => db.milestones.toArray(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const properties = useLiveQuery(() => db.properties.toArray(), [])
  const [snapping, setSnapping] = useState(false)
  const { confirm, confirmProps } = useConfirm()

  useEffect(() => { seedDefaultMilestones() }, [])

  const snaps = snapshots ?? []
  const mstones = milestones ?? []

  // Live total assets from current data (investments + properties)
  const liveAssets = (investments ?? []).reduce((s, i) => s + i.currentValue, 0)
    + (properties ?? []).reduce((s, p) => s + p.currentMarketValue, 0)

  // Current net worth from latest snapshot
  const latest = snaps[snaps.length - 1]
  const previous = snaps.length >= 2 ? snaps[snaps.length - 2] : null
  const monthlyChange = latest && previous ? latest.netWorth - previous.netWorth : 0

  // FI targets
  const monthlyExpenses = profile?.monthlyExpenses || 60000
  const annualExpenses = monthlyExpenses * 12
  const leanFI = calculateLeanFI(annualExpenses)
  const regularFI = calculateRegularFI(leanFI)
  const fatFI = calculateFatFI(regularFI)

  // Chart data
  const chartData = snaps.map(s => ({
    label: `${MONTHS[s.month - 1]} ${String(s.year).slice(2)}`,
    netWorth: s.netWorth,
    assets: s.totalAssets,
    liabilities: s.totalLiabilities,
  }))

  // FI Projection: project future net worth based on recent growth rate
  const projectionData = useMemo(() => {
    if (snaps.length < 2 || !latest) return []

    // Average monthly growth from recent snapshots (last 6 or all available)
    const recent = snaps.slice(-Math.min(snaps.length, 6))
    const growths: number[] = []
    for (let i = 1; i < recent.length; i++) {
      growths.push(recent[i].netWorth - recent[i - 1].netWorth)
    }
    const avgMonthlyGrowth = growths.length > 0 ? growths.reduce((a, b) => a + b, 0) / growths.length : 0
    if (avgMonthlyGrowth <= 0) return []

    // Project until fat FI or 20 years, whichever comes first
    const points: { label: string; projected: number }[] = []
    let projected = latest.netWorth
    let year = latest.year
    let month = latest.month

    for (let i = 0; i < 240; i++) {
      month++
      if (month > 12) { month = 1; year++ }
      // Compound growth: assume 12% annual return on existing + monthly savings addition
      projected += avgMonthlyGrowth
      if (i % 3 === 0) { // every 3 months for chart readability
        points.push({
          label: `${MONTHS[month - 1]} ${String(year).slice(2)}`,
          projected,
        })
      }
      if (projected >= fatFI) break
    }
    return points
  }, [snaps, latest, fatFI])

  // Milestone check — based on live total assets (investments + properties)
  const currentNW = latest?.netWorth ?? 0
  const achievedMilestones = mstones.filter(m => liveAssets >= m.amount).sort((a, b) => b.amount - a.amount)
  const nextMilestone = mstones.filter(m => liveAssets < m.amount).sort((a, b) => a.amount - b.amount)[0]
  const nextProgress = nextMilestone ? liveAssets / nextMilestone.amount : 1

  async function handleCapture() {
    setSnapping(true)
    try {
      await captureSnapshot()
    } finally {
      setSnapping(false)
    }
  }

  async function handleDeleteSnap(id: number) {
    const ok = await confirm({ title: 'Delete snapshot?', description: 'This snapshot will be removed from your timeline.', variant: 'destructive', confirmLabel: 'Delete' })
    if (ok) await db.netWorthSnapshots.delete(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timeline</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Track net worth over time & FI projections</p>
        </div>
        <Button onClick={handleCapture} disabled={snapping}>
          <Camera className="h-4 w-4 mr-1" /> {snapping ? 'Capturing...' : 'Capture Snapshot'}
        </Button>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Net Worth</p>
            <p className="text-xl font-bold">{fmt(currentNW, true)}</p>
            {monthlyChange !== 0 && (
              <p className={`text-xs mt-1 ${monthlyChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {monthlyChange >= 0 ? '+' : ''}{fmt(monthlyChange, true)} vs last
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Total Assets</p>
            <p className="text-xl font-bold">{fmt(liveAssets, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Total Liabilities</p>
            <p className="text-xl font-bold text-red-600">{fmt(latest?.totalLiabilities ?? 0, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Next Milestone</p>
            {nextMilestone ? (
              <>
                <p className="text-xl font-bold">{nextMilestone.label}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{formatPercent(nextProgress)} reached</p>
              </>
            ) : (
              <p className="text-xl font-bold text-emerald-600">All reached!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets, Liabilities & Net Worth</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Area type="monotone" dataKey="assets" fill={colors.assetsFill} stroke={colors.assets} fillOpacity={0.5} name="Assets" />
                <Area type="monotone" dataKey="netWorth" fill={colors.netWorthFill} stroke={colors.netWorth} fillOpacity={0.15} name="Net Worth" />
                <Area type="monotone" dataKey="liabilities" fill={colors.liabilitiesFill} stroke={colors.liabilities} fillOpacity={0.4} name="Liabilities" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />}
              title="No snapshots yet"
              description="Capture your first snapshot to start tracking your net worth over time."
              actionLabel="Capture Now"
              onAction={handleCapture}
            />
          )}
        </CardContent>
      </Card>

      {/* FI Projection */}
      {projectionData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FI Projection</CardTitle>
            <CardDescription>Based on your average monthly growth rate</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={projectionData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <ReferenceLine y={leanFI} stroke="#10b981" strokeDasharray="6 3" label={{ value: 'Lean FI', position: 'insideTopRight', fontSize: 11, fill: '#10b981' }} />
                <ReferenceLine y={regularFI} stroke="#3b82f6" strokeDasharray="6 3" label={{ value: 'Regular FI', position: 'insideTopRight', fontSize: 11, fill: '#3b82f6' }} />
                {fatFI <= (projectionData[projectionData.length - 1]?.projected || 0) * 1.2 && (
                  <ReferenceLine y={fatFI} stroke="#8b5cf6" strokeDasharray="6 3" label={{ value: 'Fat FI', position: 'insideTopRight', fontSize: 11, fill: '#8b5cf6' }} />
                )}
                <Area type="monotone" dataKey="projected" fill={colors.netWorthFill} stroke={colors.netWorth} fillOpacity={0.08} name="Projected NW" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Milestones</CardTitle>
          <CardDescription>Based on total assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mstones.sort((a, b) => a.amount - b.amount).map(m => {
              const achieved = liveAssets >= m.amount
              const progress = Math.min(liveAssets / m.amount, 1)
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${achieved ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'}`}>
                    {achieved ? '✓' : '○'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-medium ${achieved ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{m.label}</span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">{formatPercent(progress)}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${achieved ? 'bg-emerald-500' : 'bg-neutral-300 dark:text-neutral-600'}`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Snapshot History */}
      {snaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Snapshot History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Period</th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Assets</th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Liabilities</th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Net Worth</th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Change</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...snaps].reverse().map((s, idx) => {
                    const prevSnap = [...snaps].reverse()[idx + 1]
                    const change = prevSnap ? s.netWorth - prevSnap.netWorth : 0
                    return (
                      <tr key={s.id} className="border-b border-neutral-50 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                        <td className="py-2.5 px-4 font-medium">{MONTHS[(s.month || 1) - 1]} {s.year}</td>
                        <td className="py-2.5 px-2 text-right">{fmt(s.totalAssets)}</td>
                        <td className="py-2.5 px-2 text-right text-red-600">{fmt(s.totalLiabilities)}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{fmt(s.netWorth)}</td>
                        <td className={`py-2.5 px-2 text-right ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {prevSnap ? `${change >= 0 ? '+' : ''}${fmt(change, true)}` : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button onClick={() => s.id && handleDeleteSnap(s.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950">
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}
