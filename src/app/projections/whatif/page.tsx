'use client'

import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/lib/db'
import { runProjection, type ProjectionParams } from '@/lib/calculations/projections'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { useMasked } from '@/hooks/useMasked'
import { useApp } from '@/context/app-context'
import { getChartColors } from '@/lib/utils'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { ArrowLeft, RotateCcw, TrendingUp, TrendingDown, Zap, Target, Wand2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const defaultParams: ProjectionParams = {
  currentAssets: 0,
  monthlySIP: 0,
  annualSIPIncrease: 0.10,
  expectedReturn: 0.12,
  inflationRate: 0.06,
  monthlyExpenses: 60000,
  expenseInflation: 0.07,
  yearsToProject: 30,
  fiMultiplier: 25,
}

interface ScenarioTemplate {
  name: string
  icon: React.ReactNode
  apply: (base: ProjectionParams) => Partial<ProjectionParams>
}

const TEMPLATES: ScenarioTemplate[] = [
  {
    name: '+₹5K SIP',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    apply: (b) => ({ monthlySIP: b.monthlySIP + 5000 }),
  },
  {
    name: 'Prepay ₹2L',
    icon: <Zap className="h-3.5 w-3.5" />,
    apply: (b) => ({ currentAssets: b.currentAssets + 200000 }),
  },
  {
    name: '+20% Expenses',
    icon: <TrendingDown className="h-3.5 w-3.5" />,
    apply: (b) => ({ monthlyExpenses: Math.round(b.monthlyExpenses * 1.2) }),
  },
  {
    name: 'Market Downturn',
    icon: <TrendingDown className="h-3.5 w-3.5" />,
    apply: (b) => ({ expectedReturn: b.expectedReturn - 0.03 }),
  },
  {
    name: 'Raise +₹10K SIP',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    apply: (b) => ({ monthlySIP: b.monthlySIP + 10000 }),
  },
]

function formatCompact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`
  if (abs >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (abs >= 1000) return `₹${(v / 1000).toFixed(0)}K`
  return `₹${v}`
}

/**
 * Run a projection and return whether FI is reached by `targetFIYear`.
 * Automatically extends yearsToProject if needed so the target year is within the window.
 */
function reachesFIByYear(params: ProjectionParams, birthYear: number | undefined, targetFIYear: number): boolean {
  const currentYear = new Date().getFullYear()
  const needYears = targetFIYear - currentYear + 2
  const p = { ...params, yearsToProject: Math.max(params.yearsToProject, needYears) }
  const result = runProjection(p, birthYear)
  return result.fiYear !== null && result.fiYear <= targetFIYear
}

/**
 * Bisect for the minimum monthly SIP that achieves FI by `targetFIYear`,
 * holding all other parameters constant.
 */
function solveRequiredSIP(params: ProjectionParams, birthYear: number | undefined, targetFIYear: number): number | null {
  if (targetFIYear <= new Date().getFullYear()) return null
  const reachable = (sip: number) => reachesFIByYear({ ...params, monthlySIP: sip }, birthYear, targetFIYear)

  // If the current SIP already reaches FI by target year, the minimum could be much lower.
  let hi = Math.max(params.monthlySIP, 50000)
  while (!reachable(hi) && hi < 50000000) hi *= 2
  if (!reachable(hi)) return null

  let lo = 0
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (reachable(mid)) hi = mid
    else lo = mid
    if (hi - lo < 100) break
  }
  return Math.ceil(hi / 500) * 500
}

/**
 * Bisect for the minimum annual return rate that achieves FI by `targetFIYear`,
 * holding all other parameters constant.
 */
function solveRequiredReturn(params: ProjectionParams, birthYear: number | undefined, targetFIYear: number): number | null {
  if (targetFIYear <= new Date().getFullYear()) return null
  const reachable = (r: number) => reachesFIByYear({ ...params, expectedReturn: r }, birthYear, targetFIYear)

  let hi = 0.40 // 40% cap
  if (!reachable(hi)) return null

  let lo = 0
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (reachable(mid)) hi = mid
    else lo = mid
    if (hi - lo < 0.0001) break
  }
  return hi
}

/** Pretty label for a parameter key (used in "what changed" summary). */
const PARAM_LABELS: Record<keyof ProjectionParams, string> = {
  currentAssets: 'Current Assets',
  monthlySIP: 'Monthly SIP',
  annualSIPIncrease: 'SIP Step-up',
  expectedReturn: 'Return',
  inflationRate: 'Inflation',
  monthlyExpenses: 'Monthly Expenses',
  expenseInflation: 'Expense Inflation',
  yearsToProject: 'Years Projected',
  fiMultiplier: 'FI Multiplier',
}

export default function WhatIfPage() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const properties = useLiveQuery(() => db.properties.toArray(), [])
  // IndexedDB can't index booleans, so we can't use `.where('active').equals(...)`.
  // Load all and filter in-memory.
  const sips = useLiveQuery(() => db.sips.toArray().then(all => all.filter(s => s.active)), [])
  const { fmt } = useMasked()
  const { isDark } = useApp()
  const colors = getChartColors(isDark)

  const liveCurrentAssets = useMemo(() => {
    const inv = (investments ?? []).reduce((s, i) => s + i.currentValue, 0)
    const prop = (properties ?? []).reduce((s, p) => s + p.currentMarketValue, 0)
    return inv + prop
  }, [investments, properties])

  const liveTotalSIP = useMemo(() => {
    return (sips ?? []).reduce((s, sip) => s + sip.amount, 0)
  }, [sips])

  // Load base params: start from defaults, overlay saved assumption tweaks from
  // localStorage (projections page only persists assumptions, not facts), then
  // hydrate fact fields from live DB data once available.
  const [baseParams, setBaseParams] = useState<ProjectionParams>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('worthly-projection-params')
        if (saved) return { ...defaultParams, ...JSON.parse(saved) } as ProjectionParams
      } catch {}
    }
    return { ...defaultParams }
  })

  const [whatIfParams, setWhatIfParams] = useState<ProjectionParams>(() => ({ ...baseParams }))

  // Hydrate live data into both base and what-if params once on mount.
  const [hasHydrated, setHasHydrated] = useState(false)
  useEffect(() => {
    if (hasHydrated) return
    if (investments === undefined || sips === undefined || profile === undefined) return
    const liveFields = {
      currentAssets: liveCurrentAssets,
      monthlySIP: liveTotalSIP,
      monthlyExpenses: profile?.monthlyExpenses || 60000,
    }
    setBaseParams(p => ({ ...p, ...liveFields }))
    setWhatIfParams(p => ({ ...p, ...liveFields }))
    setHasHydrated(true)
  }, [hasHydrated, investments, sips, profile, liveCurrentAssets, liveTotalSIP])

  function resetToBase() {
    setWhatIfParams({ ...baseParams })
  }

  function applyTemplate(template: ScenarioTemplate) {
    const changes = template.apply(baseParams)
    setWhatIfParams(p => ({ ...p, ...changes }))
  }

  const baseResult = useMemo(() => runProjection(baseParams, profile?.birthYear), [baseParams, profile?.birthYear])
  const whatIfResult = useMemo(() => runProjection(whatIfParams, profile?.birthYear), [whatIfParams, profile?.birthYear])

  const chartData = useMemo(() => {
    return baseResult.projections.map((p, i) => ({
      year: p.year,
      age: p.age,
      base: p.portfolioValue,
      whatIf: whatIfResult.projections[i]?.portfolioValue ?? 0,
      fiTarget: p.fiTarget,
    }))
  }, [baseResult, whatIfResult])

  // Delta calculations
  const baseFIYears = baseResult.fiYear ? baseResult.fiYear - new Date().getFullYear() : null
  const whatIfFIYears = whatIfResult.fiYear ? whatIfResult.fiYear - new Date().getFullYear() : null
  const fiYearDelta = baseFIYears !== null && whatIfFIYears !== null ? whatIfFIYears - baseFIYears : null

  // Inflation-adjusted (today's rupees) value of the final portfolio, using expense inflation
  // so that purchasing power is measured against what the user actually spends.
  const inflationAdjustedFinal = useMemo(() => {
    const years = whatIfParams.yearsToProject
    const infl = whatIfParams.expenseInflation
    if (years <= 0) return whatIfResult.finalPortfolio
    return whatIfResult.finalPortfolio / Math.pow(1 + infl, years)
  }, [whatIfResult.finalPortfolio, whatIfParams.yearsToProject, whatIfParams.expenseInflation])

  // List of params that differ between what-if and base, with formatted deltas.
  const changedParams = useMemo(() => {
    const keys: (keyof ProjectionParams)[] = [
      'currentAssets', 'monthlySIP', 'annualSIPIncrease', 'expectedReturn',
      'monthlyExpenses', 'expenseInflation', 'fiMultiplier', 'yearsToProject',
    ]
    return keys
      .filter(k => (baseParams[k] as number) !== (whatIfParams[k] as number))
      .map(k => {
        const base = baseParams[k] as number
        const curr = whatIfParams[k] as number
        const diff = curr - base
        const isPct = ['annualSIPIncrease', 'expectedReturn', 'expenseInflation'].includes(k)
        const isRaw = ['fiMultiplier', 'yearsToProject'].includes(k)
        let deltaStr: string
        if (isPct) {
          const d = diff * 100
          deltaStr = `${d > 0 ? '+' : ''}${d.toFixed(1)}%`
        } else if (isRaw) {
          deltaStr = `${diff > 0 ? '+' : ''}${diff}${k === 'yearsToProject' ? 'y' : 'x'}`
        } else {
          deltaStr = `${diff > 0 ? '+' : ''}${formatCompact(diff)}`
        }
        return { key: k, label: PARAM_LABELS[k], deltaStr, diff }
      })
  }, [baseParams, whatIfParams])

  function formatDelta(base: number, current: number): string {
    const diff = current - base
    if (diff === 0) return 'no change'
    const sign = diff > 0 ? '+' : ''
    return `${sign}${formatCompact(diff)}`
  }

  function formatPercentDelta(base: number, current: number): string {
    const diff = (current - base) * 100
    if (Math.abs(diff) < 0.05) return 'no change'
    const sign = diff > 0 ? '+' : ''
    return `${sign}${diff.toFixed(1)}%`
  }

  // ─── Goal-Seek state ─────────────────────────────────────────────────
  const [goalSeekYear, setGoalSeekYear] = useState(() => {
    const curr = new Date().getFullYear()
    return curr + 15
  })
  const [goalSeekResult, setGoalSeekResult] = useState<{
    kind: 'sip' | 'return'
    value: number | null
  } | null>(null)

  function handleSolveSIP() {
    const v = solveRequiredSIP(whatIfParams, profile?.birthYear, goalSeekYear)
    setGoalSeekResult({ kind: 'sip', value: v })
  }
  function handleSolveReturn() {
    const v = solveRequiredReturn(whatIfParams, profile?.birthYear, goalSeekYear)
    setGoalSeekResult({ kind: 'return', value: v })
  }
  function applyGoalSeek() {
    if (!goalSeekResult || goalSeekResult.value === null) return
    if (goalSeekResult.kind === 'sip') {
      setWhatIfParams(p => ({ ...p, monthlySIP: goalSeekResult.value as number }))
    } else {
      setWhatIfParams(p => ({ ...p, expectedReturn: goalSeekResult.value as number }))
    }
  }

  // Invalidate stale goal-seek result when user drags sliders afterwards
  useEffect(() => {
    setGoalSeekResult(null)
  }, [whatIfParams, goalSeekYear])

  // Slider config
  const sliders: {
    key: keyof ProjectionParams
    label: string
    min: number
    max: number
    step: number
    format: (v: number) => string
    deltaFormat: (base: number, curr: number) => string
    invertDelta?: boolean // if true, higher = worse (e.g., expenses)
  }[] = [
    {
      key: 'currentAssets', label: 'Current Assets',
      min: 0, max: Math.max(baseParams.currentAssets * 3, 10000000), step: 50000,
      format: formatCompact, deltaFormat: formatDelta,
    },
    {
      key: 'monthlySIP', label: 'Monthly SIP',
      min: 0, max: Math.max(baseParams.monthlySIP * 3, 200000), step: 1000,
      format: formatCompact, deltaFormat: formatDelta,
    },
    {
      key: 'annualSIPIncrease', label: 'Annual SIP Step-up',
      min: 0, max: 0.30, step: 0.01,
      format: (v) => `${(v * 100).toFixed(0)}%`, deltaFormat: formatPercentDelta,
    },
    {
      key: 'expectedReturn', label: 'Expected Return',
      min: 0.04, max: 0.20, step: 0.005,
      format: (v) => `${(v * 100).toFixed(1)}%`, deltaFormat: formatPercentDelta,
    },
    {
      key: 'monthlyExpenses', label: 'Monthly Expenses',
      min: 10000, max: Math.max(baseParams.monthlyExpenses * 3, 500000), step: 1000,
      format: formatCompact, deltaFormat: formatDelta, invertDelta: true,
    },
    {
      key: 'expenseInflation', label: 'Expense Inflation',
      min: 0.02, max: 0.15, step: 0.005,
      format: (v) => `${(v * 100).toFixed(1)}%`, deltaFormat: formatPercentDelta, invertDelta: true,
    },
    {
      key: 'fiMultiplier', label: 'FI Multiplier',
      min: 15, max: 40, step: 1,
      format: (v) => `${v}x`, deltaFormat: (b, c) => {
        const diff = c - b
        if (diff === 0) return 'no change'
        return `${diff > 0 ? '+' : ''}${diff}x`
      }, invertDelta: true,
    },
    {
      key: 'yearsToProject', label: 'Years to Project',
      min: 10, max: 50, step: 1,
      format: (v) => `${v}y`, deltaFormat: (b, c) => {
        const diff = c - b
        if (diff === 0) return 'no change'
        return `${diff > 0 ? '+' : ''}${diff}y`
      },
    },
  ]

  function getSliderDeltaColor(key: keyof ProjectionParams, invert?: boolean): 'green' | 'red' | 'neutral' {
    const base = baseParams[key] as number
    const curr = whatIfParams[key] as number
    if (base === curr) return 'neutral'
    const isIncrease = curr > base
    if (invert) return isIncrease ? 'red' : 'green'
    return isIncrease ? 'green' : 'red'
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projections">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">What-If Simulator</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">See how changes affect your FI timeline</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={resetToBase}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      </div>

      {/* Scenario Templates */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map(t => (
          <button
            key={t.name}
            onClick={() => applyTemplate(t)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            {t.icon}
            {t.name}
          </button>
        ))}
      </div>

      {/* Before / After Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Base */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full bg-neutral-400 dark:bg-neutral-500" />
              <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Base (Current)</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">FI Year</span>
                <span className="font-bold">{baseResult.fiYear ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Years to FI</span>
                <span className="font-bold">{baseFIYears ?? '30+'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Final Portfolio</span>
                <span className="font-bold">{fmt(baseResult.finalPortfolio)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">FI Corpus</span>
                <span className="font-bold">{fmt(baseResult.finalFITarget)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What-If */}
        <Card className="ring-2 ring-neutral-300 dark:ring-neutral-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors.portfolio }} />
              <span className="text-sm font-semibold">What-If</span>
              {fiYearDelta !== null && fiYearDelta !== 0 && (
                <Badge variant={fiYearDelta < 0 ? 'success' : 'danger'}>
                  {fiYearDelta < 0 ? `${fiYearDelta}y` : `+${fiYearDelta}y`} to FI
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">FI Year</span>
                <span className="font-bold">{whatIfResult.fiYear ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Years to FI</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{whatIfFIYears ?? '30+'}</span>
                  {fiYearDelta !== null && fiYearDelta !== 0 && (
                    <span className={`text-xs font-medium ${fiYearDelta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      ({fiYearDelta < 0 ? '' : '+'}{fiYearDelta})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Final Portfolio</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{fmt(whatIfResult.finalPortfolio)}</span>
                  {whatIfResult.finalPortfolio !== baseResult.finalPortfolio && (
                    <span className={`text-xs font-medium ${whatIfResult.finalPortfolio >= baseResult.finalPortfolio ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      ({formatDelta(baseResult.finalPortfolio, whatIfResult.finalPortfolio)})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400 pl-3 text-xs italic">in today's ₹</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{fmt(Math.round(inflationAdjustedFinal))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">FI Corpus</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{fmt(whatIfResult.finalFITarget)}</span>
                  {whatIfResult.finalFITarget !== baseResult.finalFITarget && (
                    <span className={`text-xs font-medium ${whatIfResult.finalFITarget <= baseResult.finalFITarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      ({formatDelta(baseResult.finalFITarget, whatIfResult.finalFITarget)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Changes summary */}
      {changedParams.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                {changedParams.length} change{changedParams.length !== 1 ? 's' : ''}
              </span>
              {changedParams.map(c => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                >
                  <span className="text-neutral-600 dark:text-neutral-300">{c.label}</span>
                  <span className={`font-medium ${c.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {c.deltaStr}
                  </span>
                </span>
              ))}
              <button
                onClick={resetToBase}
                className="ml-auto text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline"
              >
                Reset all
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal-Seek */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Goal-Seek
          </CardTitle>
          <CardDescription>Work backwards: pick a target FI year, and we'll solve for the required SIP or return rate.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Target FI Year</Label>
              <Input
                type="number"
                value={goalSeekYear}
                onChange={e => setGoalSeekYear(Number(e.target.value))}
                className="h-9 w-28 text-sm"
                min={new Date().getFullYear() + 1}
                max={new Date().getFullYear() + 60}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSolveSIP}>
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Solve SIP
            </Button>
            <Button variant="outline" size="sm" onClick={handleSolveReturn}>
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Solve Return
            </Button>
          </div>

          {goalSeekResult && (
            <div className="mt-4 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              {goalSeekResult.value === null ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Unreachable. FI by {goalSeekYear} isn't possible by changing {goalSeekResult.kind === 'sip' ? 'SIP alone' : 'return alone'} — try adjusting other parameters too.
                </p>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {goalSeekResult.kind === 'sip' ? 'Required Monthly SIP' : 'Required Annual Return'}
                    </p>
                    <p className="text-xl font-bold">
                      {goalSeekResult.kind === 'sip'
                        ? fmt(goalSeekResult.value)
                        : `${(goalSeekResult.value * 100).toFixed(2)}%`}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {goalSeekResult.kind === 'sip' ? (
                        <>vs current {fmt(whatIfParams.monthlySIP)}/mo · {formatDelta(whatIfParams.monthlySIP, goalSeekResult.value)}</>
                      ) : (
                        <>vs current {(whatIfParams.expectedReturn * 100).toFixed(1)}% · {formatPercentDelta(whatIfParams.expectedReturn, goalSeekResult.value)}</>
                      )}
                    </p>
                  </div>
                  <Button size="sm" onClick={applyGoalSeek}>
                    Apply to sliders
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overlapping Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base vs What-If</CardTitle>
          <CardDescription>Gray dashed = base, solid = what-if scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: colors.axis }}
                  interval={Math.floor(whatIfParams.yearsToProject / 10)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: colors.axis }}
                  tickFormatter={(v) => {
                    if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`
                    if (v >= 100000) return `${(v / 100000).toFixed(0)}L`
                    return `${(v / 1000).toFixed(0)}K`
                  }}
                />
                <Tooltip
                  formatter={(v: any) => fmt(Number(v))}
                  labelFormatter={(label) => {
                    const d = chartData.find(c => c.year === label)
                    return d?.age ? `${label} (Age ${d.age})` : String(label)
                  }}
                  contentStyle={{ backgroundColor: colors.tooltip, border: `1px solid ${colors.tooltipBorder}` }}
                />
                <Line
                  type="monotone"
                  dataKey="base"
                  stroke={isDark ? '#525252' : '#a3a3a3'}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="Base"
                />
                <Line
                  type="monotone"
                  dataKey="whatIf"
                  stroke={colors.portfolio}
                  strokeWidth={2}
                  dot={false}
                  name="What-If"
                />
                <Line
                  type="monotone"
                  dataKey="fiTarget"
                  stroke={colors.fiTarget}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="FI Target"
                />
                {baseResult.fiYear && (
                  <ReferenceLine
                    x={baseResult.fiYear}
                    stroke={isDark ? '#525252' : '#a3a3a3'}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    label={{ value: `Base FI`, position: 'top', fontSize: 10, fill: isDark ? '#737373' : '#a3a3a3' }}
                  />
                )}
                {whatIfResult.fiYear && whatIfResult.fiYear !== baseResult.fiYear && (
                  <ReferenceLine
                    x={whatIfResult.fiYear}
                    stroke={colors.fiLine}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{ value: `What-If FI`, position: 'top', fontSize: 10, fill: colors.fiLine }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sliders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adjust Parameters</CardTitle>
          <CardDescription>Drag sliders to see real-time impact on your FI timeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {sliders.map(s => {
              const baseVal = baseParams[s.key] as number
              const currVal = whatIfParams[s.key] as number
              const deltaStr = s.deltaFormat(baseVal, currVal)
              const isChanged = deltaStr !== 'no change'
              return (
                <Slider
                  key={s.key}
                  label={s.label}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={currVal}
                  baseValue={baseVal}
                  onChange={e => setWhatIfParams(p => ({ ...p, [s.key]: Number(e.target.value) }))}
                  formattedValue={s.format(currVal)}
                  delta={isChanged ? deltaStr : undefined}
                  deltaColor={getSliderDeltaColor(s.key, s.invertDelta)}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
