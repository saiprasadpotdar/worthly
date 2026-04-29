'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useMasked } from '@/hooks/useMasked'
import { useApp } from '@/context/app-context'
import { db, captureSnapshot, seedDefaultMilestones } from '@/lib/db'
import { formatPercent, getChartColors } from '@/lib/utils'
import { runProjection, type ProjectionParams } from '@/lib/calculations/projections'
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
  const sips = useLiveQuery(() => db.sips.toArray().then(all => all.filter(s => s.active)), [])
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

  // FI targets — read configurable multiplier from user profile (Settings)
  const monthlyExpenses = profile?.monthlyExpenses || 60000
  const annualExpenses = monthlyExpenses * 12
  const fiMultiplier = profile?.fiMultiplier ?? 25
  const regularFI = annualExpenses * fiMultiplier
  const leanFI = regularFI * 0.5
  const fatFI = regularFI * 2

  // Chart data
  const chartData = snaps.map(s => ({
    label: `${MONTHS[s.month - 1]} ${String(s.year).slice(2)}`,
    netWorth: s.netWorth,
    assets: s.totalAssets,
    liabilities: s.totalLiabilities,
  }))

  // Allocation over time data (2.1) — stacked from snapshot equity/debt/realAssets
  const [showAllocPercent, setShowAllocPercent] = useState(false)
  const allocationTimeData = snaps.map(s => {
    const total = s.equity + s.debt + s.realAssets
    if (showAllocPercent && total > 0) {
      return {
        label: `${MONTHS[s.month - 1]} ${String(s.year).slice(2)}`,
        equity: (s.equity / total) * 100,
        debt: (s.debt / total) * 100,
        realAssets: (s.realAssets / total) * 100,
      }
    }
    return {
      label: `${MONTHS[s.month - 1]} ${String(s.year).slice(2)}`,
      equity: s.equity,
      debt: s.debt,
      realAssets: s.realAssets,
    }
  })

  // FI Projection: use compound growth via runProjection (1.11)
  const projectionData = useMemo(() => {
    if (!latest) return []

    // Read stored assumption params from localStorage
    let storedParams = { expectedReturn: 0.12, expenseInflation: 0.07, annualSIPIncrease: 0.10, fiMultiplier: 25, yearsToProject: 30 }
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('worthly-projection-params') : null
      if (saved) storedParams = { ...storedParams, ...JSON.parse(saved) }
    } catch {}

    const totalSIP = (sips ?? []).reduce((s, sip) => s + sip.amount, 0)
    const params: ProjectionParams = {
      currentAssets: latest.netWorth,
      monthlySIP: totalSIP > 0 ? totalSIP : 50000,
      annualSIPIncrease: storedParams.annualSIPIncrease,
      expectedReturn: storedParams.expectedReturn,
      inflationRate: 0.06,
      monthlyExpenses: monthlyExpenses,
      expenseInflation: storedParams.expenseInflation,
      yearsToProject: Math.min(storedParams.yearsToProject, 30),
      fiMultiplier: storedParams.fiMultiplier,
    }

    const result = runProjection(params, profile?.birthYear)
    // Convert to chart data, sampling every year, starting from latest snapshot date
    return result.projections.slice(1).map(p => ({
      label: `${String(p.year)}`,
      projected: p.portfolioValue,
    }))
  }, [latest, sips, monthlyExpenses, profile?.birthYear])

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

      {/* Allocation Over Time (2.1) */}
      {allocationTimeData.length > 1 && allocationTimeData.some(d => d.equity > 0 || d.debt > 0 || d.realAssets > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Allocation Over Time</CardTitle>
              <button
                onClick={() => setShowAllocPercent(p => !p)}
                className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1"
              >
                {showAllocPercent ? '₹ Values' : '% Split'}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={allocationTimeData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => showAllocPercent ? `${v.toFixed(0)}%` : fmt(v, true)}
                  tick={{ fontSize: 11 }}
                  width={70}
                />
                <Tooltip formatter={(v: any) => showAllocPercent ? `${Number(v).toFixed(1)}%` : fmt(Number(v))} />
                <Area type="monotone" dataKey="equity" stackId="1" fill="#10b981" stroke="#10b981" fillOpacity={0.6} name="Equity" />
                <Area type="monotone" dataKey="debt" stackId="1" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.6} name="Debt" />
                <Area type="monotone" dataKey="realAssets" stackId="1" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.6} name="Real Estate" />
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
                      <div className="flex items-center gap-2">
                        {m.achievedDate && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            {m.achievedDate.slice(0, 7)}{m.monthsTaken ? ` (${m.monthsTaken}mo)` : ''}
                          </span>
                        )}
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">{formatPercent(progress)}</span>
                      </div>
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
