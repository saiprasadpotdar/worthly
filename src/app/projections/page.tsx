'use client'

import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/lib/db'
import { runProjection, runScenarios, type ProjectionParams } from '@/lib/calculations/projections'
import { calculateCoastFI, calculateBaristaFI } from '@/lib/calculations/coast-fi'
import { runMonteCarlo, type MonteCarloParams } from '@/lib/calculations/monte-carlo'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useMasked } from '@/hooks/useMasked'
import { useApp } from '@/context/app-context'
import { getChartColors, formatCurrency as fmtCurrency } from '@/lib/utils'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Calculator, TrendingUp, Target, Calendar, Compass, Coffee, ArrowRight, Dice5, Share2, Heart } from 'lucide-react'
import { formatPercent } from '@/lib/utils'
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

export default function ProjectionsPage() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const properties = useLiveQuery(() => db.properties.toArray(), [])
  // Note: filter in-memory — IndexedDB can't index boolean fields so
  // `db.sips.where('active').equals(...)` silently returns nothing.
  const sips = useLiveQuery(() => db.sips.toArray().then(all => all.filter(s => s.active)), [])
  const { fmt } = useMasked()
  const { isDark } = useApp()
  const colors = getChartColors(isDark)

  const currentAssets = useMemo(() => {
    const inv = (investments ?? []).reduce((s, i) => s + i.currentValue, 0)
    const prop = (properties ?? []).reduce((s, p) => s + p.currentMarketValue, 0)
    return inv + prop
  }, [investments, properties])

  const totalSIP = useMemo(() => {
    return (sips ?? []).reduce((s, sip) => s + sip.amount, 0)
  }, [sips])

  const STORAGE_KEY = 'worthly-projection-params'

  // Only "assumption" fields are persisted. Live-data fields (currentAssets,
  // monthlySIP, monthlyExpenses) are always re-synced from the database on mount
  // so projections reflect reality unless the user is actively tweaking them.
  const [params, setParams] = useState<ProjectionParams>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) return { ...defaultParams, ...JSON.parse(saved) } as ProjectionParams
      } catch {}
    }
    return { ...defaultParams }
  })

  // Persist only assumption tweaks — never the live-data fields.
  useEffect(() => {
    const { currentAssets: _ca, monthlySIP: _ms, monthlyExpenses: _me, ...persistable } = params
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable))
  }, [params])

  // Hydrate from URL hash if present (3.4)
  const [sharedCopied, setSharedCopied] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.slice(1)
    if (!hash) return
    try {
      const decoded = JSON.parse(atob(hash))
      setParams(p => ({ ...p, ...decoded }))
      // Clear hash after loading
      window.history.replaceState(null, '', window.location.pathname)
    } catch {}
  }, [])

  function handleShare() {
    const { currentAssets: _ca, monthlySIP: _ms, monthlyExpenses: _me, ...shareable } = params
    const encoded = btoa(JSON.stringify(shareable))
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`
    navigator.clipboard.writeText(url)
    setSharedCopied(true)
    setTimeout(() => setSharedCopied(false), 2000)
  }

  // Sync live data into params once as soon as it's available (on every mount).
  const [hasHydrated, setHasHydrated] = useState(false)
  useEffect(() => {
    if (hasHydrated) return
    if (investments === undefined || sips === undefined || profile === undefined) return
    setParams(p => ({
      ...p,
      currentAssets,
      monthlySIP: totalSIP,
      monthlyExpenses: profile?.monthlyExpenses || p.monthlyExpenses || 60000,
      fiMultiplier: profile?.fiMultiplier ?? p.fiMultiplier ?? 25,
    }))
    setHasHydrated(true)
  }, [hasHydrated, investments, sips, profile, currentAssets, totalSIP])

  const result = useMemo(() => {
    return runProjection(params, profile?.birthYear)
  }, [params, profile?.birthYear])

  const fiYearData = result.fiYear
    ? result.projections.find(p => p.year === result.fiYear)
    : null

  function updateParam(key: keyof ProjectionParams, value: number) {
    setParams(p => ({ ...p, [key]: value }))
  }

  const chartData = result.projections.map(p => ({
    year: p.year,
    age: p.age,
    portfolio: p.portfolioValue,
    fiTarget: p.fiTarget,
    invested: p.totalInvested,
  }))

  // FI milestone crossing years (3.3)
  const fiMilestoneYears = useMemo(() => {
    const milestones: { label: string; year: number; color: string }[] = []
    const proj = result.projections
    for (let i = 1; i < proj.length; i++) {
      const leanTarget = proj[i].annualExpenses * params.fiMultiplier * 0.5
      const fatTarget = proj[i].annualExpenses * params.fiMultiplier * 2
      // Lean FI crossing
      if (proj[i].portfolioValue >= leanTarget && proj[i - 1].portfolioValue < (proj[i - 1].annualExpenses * params.fiMultiplier * 0.5)) {
        milestones.push({ label: `Lean FI`, year: proj[i].year, color: '#10b981' })
      }
      // Regular FI crossing (already tracked by result.fiYear, but add for consistency)
      if (proj[i].fiReached && !proj[i - 1].fiReached) {
        milestones.push({ label: `Regular FI`, year: proj[i].year, color: '#3b82f6' })
      }
      // Fat FI crossing
      if (proj[i].portfolioValue >= fatTarget && proj[i - 1].portfolioValue < (proj[i - 1].annualExpenses * params.fiMultiplier * 2)) {
        milestones.push({ label: `Fat FI`, year: proj[i].year, color: '#8b5cf6' })
      }
    }
    return milestones
  }, [result.projections, params.fiMultiplier])

  // ─── Multi-Scenario ───────────────────────────────────
  const scenarioResults = useMemo(() => {
    return runScenarios([
      { name: 'Pessimistic', params: { ...params, expectedReturn: params.expectedReturn - 0.02 }, color: colors.pessimistic },
      { name: 'Base', params, color: colors.base },
      { name: 'Optimistic', params: { ...params, expectedReturn: params.expectedReturn + 0.02 }, color: colors.optimistic },
    ], profile?.birthYear)
  }, [params, profile?.birthYear, colors.pessimistic, colors.base, colors.optimistic])

  const scenarioChartData = useMemo(() => {
    const base = scenarioResults[1].result.projections
    return base.map((p, i) => ({
      year: p.year,
      age: p.age,
      pessimistic: scenarioResults[0].result.projections[i]?.portfolioValue ?? 0,
      base: p.portfolioValue,
      optimistic: scenarioResults[2].result.projections[i]?.portfolioValue ?? 0,
      fiTarget: p.fiTarget,
    }))
  }, [scenarioResults])

  // ─── Coast FI / Barista FI ────────────────────────────
  const [retirementAge, setRetirementAge] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('worthly-retirement-age')
      return saved ? Number(saved) : 50
    }
    return 50
  })
  const [partTimeIncome, setPartTimeIncome] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('worthly-parttime-income')
      return saved ? Number(saved) : 30000
    }
    return 30000
  })

  useEffect(() => {
    localStorage.setItem('worthly-retirement-age', String(retirementAge))
  }, [retirementAge])
  useEffect(() => {
    localStorage.setItem('worthly-parttime-income', String(partTimeIncome))
  }, [partTimeIncome])

  const currentAge = profile?.birthYear ? new Date().getFullYear() - profile.birthYear : null
  const yearsToRetirement = currentAge ? Math.max(0, retirementAge - currentAge) : 20

  const fiTarget = params.monthlyExpenses * 12 * params.fiMultiplier
  const coastFI = useMemo(() =>
    calculateCoastFI(fiTarget, params.currentAssets, params.expectedReturn, params.expenseInflation, yearsToRetirement),
    [fiTarget, params.currentAssets, params.expectedReturn, params.expenseInflation, yearsToRetirement]
  )
  const baristaFI = useMemo(() =>
    calculateBaristaFI(params.monthlyExpenses * 12, partTimeIncome, params.currentAssets, params.fiMultiplier),
    [params.monthlyExpenses, partTimeIncome, params.currentAssets, params.fiMultiplier]
  )

  // Monte Carlo simulation (3.1)
  const [mcStdDev, setMcStdDev] = useState(0.15)
  const [mcSims, setMcSims] = useState(500)
  const monteCarloResult = useMemo(() => {
    const mcParams: MonteCarloParams = {
      currentAssets: params.currentAssets,
      monthlySIP: params.monthlySIP,
      annualSIPIncrease: params.annualSIPIncrease,
      expectedReturn: params.expectedReturn,
      returnStdDev: mcStdDev,
      monthlyExpenses: params.monthlyExpenses,
      expenseInflation: params.expenseInflation,
      yearsToProject: params.yearsToProject,
      fiMultiplier: params.fiMultiplier,
      numSimulations: mcSims,
    }
    return runMonteCarlo(mcParams)
  }, [params, mcStdDev, mcSims])

  // Parent care cost modeling (4.2)
  const [parentCare, setParentCare] = useState({
    monthlyCost: 0,
    startYear: new Date().getFullYear() + 5,
    endYear: new Date().getFullYear() + 25,
    medicalInflation: 0.10,
  })

  const parentCareImpact = useMemo(() => {
    if (parentCare.monthlyCost <= 0) return null
    const currentYear = new Date().getFullYear()
    let totalCost = 0
    let currentCost = parentCare.monthlyCost * 12
    for (let y = parentCare.startYear; y <= parentCare.endYear; y++) {
      const yearsFromNow = y - currentYear
      if (yearsFromNow > 0) {
        const inflatedCost = currentCost * Math.pow(1 + parentCare.medicalInflation, yearsFromNow)
        totalCost += inflatedCost
      }
    }
    // Equivalent extra monthly expense (spread over projection period)
    const months = params.yearsToProject * 12
    const equivalentMonthly = months > 0 ? totalCost / months : 0
    return { totalCost: Math.round(totalCost), equivalentMonthly: Math.round(equivalentMonthly) }
  }, [parentCare, params.yearsToProject])

  const mcChartData = monteCarloResult.yearData.map(d => ({
    year: d.year,
    p10: d.p10,
    p25: d.p25,
    p50: d.p50,
    p75: d.p75,
    p90: d.p90,
    fiTarget: d.fiTarget,
  }))

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FI Projections</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Project when you'll reach financial independence</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" /> {sharedCopied ? 'Copied!' : 'Share'}
          </Button>
          <Link href="/projections/whatif">
            <Button variant="outline" size="sm">
              <Compass className="h-4 w-4 mr-1" /> What-If Simulator
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single Projection</TabsTrigger>
          <TabsTrigger value="scenarios">Scenario Comparison</TabsTrigger>
          <TabsTrigger value="montecarlo">Monte Carlo</TabsTrigger>
        </TabsList>

        {/* ─── Single Projection Tab ───────────────────────── */}
        <TabsContent value="single" className="mt-4 space-y-6">
          {/* Result Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <Target className="h-3.5 w-3.5" /> FI Year
                </div>
                <p className="text-lg font-bold">{result.fiYear ?? 'N/A'}</p>
                {result.fiAge && <p className="text-xs text-neutral-500 dark:text-neutral-400">Age {result.fiAge}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Years to FI
                </div>
                <p className="text-lg font-bold">
                  {result.fiYear ? result.fiYear - new Date().getFullYear() : '30+'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">from now</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> FI Corpus
                </div>
                <p className="text-lg font-bold">{fmt(fiYearData?.fiTarget ?? result.finalFITarget)}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">target at FI</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <Calculator className="h-3.5 w-3.5" /> Total Invested
                </div>
                <p className="text-lg font-bold">{fmt(result.totalInvested)}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">over {params.yearsToProject}y</p>
              </CardContent>
            </Card>
          </div>

          {/* Coast FI / Barista FI */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advanced FI Milestones</CardTitle>
              <CardDescription>Coast FI & Barista FI based on your current portfolio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <Label className="text-xs">Retirement Age</Label>
                  <Input
                    type="number"
                    value={retirementAge}
                    onChange={e => setRetirementAge(Math.max(25, Math.min(80, Number(e.target.value))))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Part-time Monthly Income</Label>
                  <Input
                    type="number"
                    value={partTimeIncome || ''}
                    onChange={e => setPartTimeIncome(Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
                {currentAge && (
                  <div className="flex items-end">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 pb-2">
                      Current age: {currentAge} · {yearsToRetirement}y to retirement
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Coast FI Card */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-semibold">Coast FI</span>
                    </div>
                    <Badge variant={coastFI.coastFIReached ? 'success' : 'warning'}>
                      {coastFI.coastFIReached ? 'Reached!' : 'In Progress'}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Portfolio needed today to reach FI by age {retirementAge} with zero new contributions
                  </p>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-600 dark:text-neutral-300">{fmt(params.currentAssets)}</span>
                      <span className="font-medium">{fmt(coastFI.coastFITarget)}</span>
                    </div>
                    <Progress value={coastFI.coastFIProgress * 100} className="h-2" indicatorClassName="bg-blue-500" />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {(coastFI.coastFIProgress * 100).toFixed(1)}% of Coast FI
                    </p>
                  </div>
                </div>

                {/* Barista FI Card */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-semibold">Barista FI</span>
                    </div>
                    <Badge variant={baristaFI.baristaFIReached ? 'success' : 'warning'}>
                      {baristaFI.baristaFIReached ? 'Reached!' : 'In Progress'}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    FI target if part-time work ({fmt(partTimeIncome)}/mo) covers the expense gap
                  </p>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-600 dark:text-neutral-300">{fmt(params.currentAssets)}</span>
                      <span className="font-medium">{fmt(baristaFI.baristaFITarget)}</span>
                    </div>
                    <Progress value={baristaFI.baristaFIProgress * 100} className="h-2" indicatorClassName="bg-amber-500" />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {(baristaFI.baristaFIProgress * 100).toFixed(1)}% of Barista FI · Gap: {fmt(baristaFI.annualGap)}/yr
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio vs FI Target</CardTitle>
              <CardDescription>When your portfolio crosses the FI target line, you're financially independent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: colors.axis }}
                      interval={Math.floor(params.yearsToProject / 10)}
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
                    <Area
                      type="monotone"
                      dataKey="invested"
                      stroke={colors.invested}
                      fill={colors.investedFill}
                      strokeWidth={1.5}
                      name="Invested"
                    />
                    <Area
                      type="monotone"
                      dataKey="portfolio"
                      stroke={colors.portfolio}
                      fill={colors.portfolioFill}
                      strokeWidth={2}
                      name="Portfolio"
                    />
                    <Area
                      type="monotone"
                      dataKey="fiTarget"
                      stroke={colors.fiTarget}
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      name="FI Target"
                    />
                    {fiMilestoneYears.map(m => (
                      <ReferenceLine
                        key={m.label}
                        x={m.year}
                        stroke={m.color}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        label={{ value: `${m.label} ${m.year}`, position: 'top', fontSize: 10, fill: m.color }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projection Parameters</CardTitle>
              <CardDescription>Tweak these to see how different scenarios affect your FI timeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label>Current Assets</Label>
                  <Input
                    type="number"
                    value={params.currentAssets || ''}
                    onChange={e => updateParam('currentAssets', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Monthly SIP</Label>
                  <Input
                    type="number"
                    value={params.monthlySIP || ''}
                    onChange={e => updateParam('monthlySIP', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Annual SIP Step-up (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={Math.round(params.annualSIPIncrease * 100)}
                    onChange={e => updateParam('annualSIPIncrease', Number(e.target.value) / 100)}
                  />
                </div>
                <div>
                  <Label>Expected Return (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={Math.round(params.expectedReturn * 100 * 10) / 10}
                    onChange={e => updateParam('expectedReturn', Number(e.target.value) / 100)}
                  />
                </div>
                <div>
                  <Label>Monthly Expenses</Label>
                  <Input
                    type="number"
                    value={params.monthlyExpenses || ''}
                    onChange={e => updateParam('monthlyExpenses', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Expense Inflation (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={Math.round(params.expenseInflation * 100 * 10) / 10}
                    onChange={e => updateParam('expenseInflation', Number(e.target.value) / 100)}
                  />
                </div>
                <div>
                  <Label>FI Multiplier (x expenses)</Label>
                  <Input
                    type="number"
                    value={params.fiMultiplier}
                    onChange={e => updateParam('fiMultiplier', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Years to Project</Label>
                  <Input
                    type="number"
                    value={params.yearsToProject}
                    onChange={e => updateParam('yearsToProject', Math.min(50, Number(e.target.value)))}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setParams(p => ({
                    ...p,
                    currentAssets,
                    monthlySIP: totalSIP,
                    monthlyExpenses: profile?.monthlyExpenses || 60000,
                  }))
                }}
              >
                Reset to current data
              </Button>
            </CardContent>
          </Card>

          {/* Parent Care Cost Modeling (4.2) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4" /> Parent Care Cost Modeling</CardTitle>
              <CardDescription>Optional: model time-bounded parent care expenses with medical inflation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Monthly Cost (today)</Label>
                  <Input
                    type="number"
                    value={parentCare.monthlyCost || ''}
                    onChange={e => setParentCare(p => ({ ...p, monthlyCost: Number(e.target.value) }))}
                    className="h-8 text-sm"
                    placeholder="e.g. 30000"
                  />
                </div>
                <div>
                  <Label className="text-xs">Start Year</Label>
                  <Input
                    type="number"
                    value={parentCare.startYear}
                    onChange={e => setParentCare(p => ({ ...p, startYear: Number(e.target.value) }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">End Year</Label>
                  <Input
                    type="number"
                    value={parentCare.endYear}
                    onChange={e => setParentCare(p => ({ ...p, endYear: Number(e.target.value) }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Medical Inflation (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={Math.round(parentCare.medicalInflation * 100)}
                    onChange={e => setParentCare(p => ({ ...p, medicalInflation: Number(e.target.value) / 100 }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              {parentCareImpact && (
                <div className="mt-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-sm">
                    Total parent care cost: <span className="font-bold">{fmt(parentCareImpact.totalCost)}</span>
                    {' · '}Equivalent to <span className="font-bold">{fmt(parentCareImpact.equivalentMonthly)}/mo</span> extra expense over {params.yearsToProject} years
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Consider adding this to your monthly expenses for a more conservative FI timeline
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Year-by-year table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Year-by-Year Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500 dark:text-neutral-400">
                      <th className="pb-2 pr-4">Year</th>
                      {profile?.birthYear && <th className="pb-2 pr-4">Age</th>}
                      <th className="pb-2 pr-4 text-right">Portfolio</th>
                      <th className="pb-2 pr-4 text-right">Invested</th>
                      <th className="pb-2 pr-4 text-right">Returns</th>
                      <th className="pb-2 pr-4 text-right">Monthly SIP</th>
                      <th className="pb-2 pr-4 text-right">FI Target</th>
                      <th className="pb-2 text-center">FI?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.projections.filter((_, i) => i % (params.yearsToProject > 20 ? 2 : 1) === 0 || _.fiReached).map(p => (
                      <tr
                        key={p.year}
                        className={`border-b border-neutral-50 dark:border-neutral-800 ${p.year === result.fiYear ? 'bg-emerald-50 dark:bg-emerald-950 font-medium' : ''}`}
                      >
                        <td className="py-1.5 pr-4">{p.year}</td>
                        {profile?.birthYear && <td className="py-1.5 pr-4">{p.age}</td>}
                        <td className="py-1.5 pr-4 text-right">{fmt(p.portfolioValue)}</td>
                        <td className="py-1.5 pr-4 text-right">{fmt(p.totalInvested)}</td>
                        <td className="py-1.5 pr-4 text-right">{fmt(p.totalReturns)}</td>
                        <td className="py-1.5 pr-4 text-right">{fmt(p.monthlySIP)}</td>
                        <td className="py-1.5 pr-4 text-right">{fmt(p.fiTarget)}</td>
                        <td className="py-1.5 text-center">{p.fiReached ? '✓' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Scenario Comparison Tab ─────────────────────── */}
        <TabsContent value="scenarios" className="mt-4 space-y-6">
          {/* Scenario Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scenarioResults.map(s => (
              <Card key={s.name} className={s.name === 'Base' ? 'ring-2 ring-neutral-300 dark:ring-neutral-600' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      ({((s.result === scenarioResults[1].result ? params.expectedReturn : s.name === 'Pessimistic' ? params.expectedReturn - 0.02 : params.expectedReturn + 0.02) * 100).toFixed(0)}% return)
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400">FI Year</span>
                      <span className="font-bold">{s.result.fiYear ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400">Years to FI</span>
                      <span className="font-bold">{s.result.fiYear ? s.result.fiYear - new Date().getFullYear() : '30+'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400">FI Corpus</span>
                      <span className="font-bold">{fmt(s.result.fiYear ? s.result.projections.find(p => p.year === s.result.fiYear)?.fiTarget ?? 0 : s.result.finalFITarget)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Scenario Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scenario Comparison</CardTitle>
              <CardDescription>3 scenarios: pessimistic (-2%), base, optimistic (+2%) return rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scenarioChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: colors.axis }}
                      interval={Math.floor(params.yearsToProject / 10)}
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
                        const d = scenarioChartData.find(c => c.year === label)
                        return d?.age ? `${label} (Age ${d.age})` : String(label)
                      }}
                      contentStyle={{ backgroundColor: colors.tooltip, border: `1px solid ${colors.tooltipBorder}` }}
                    />
                    <Line type="monotone" dataKey="pessimistic" stroke={colors.pessimistic} strokeWidth={2} dot={false} name="Pessimistic" />
                    <Line type="monotone" dataKey="base" stroke={colors.base} strokeWidth={2} dot={false} name="Base" />
                    <Line type="monotone" dataKey="optimistic" stroke={colors.optimistic} strokeWidth={2} dot={false} name="Optimistic" />
                    <Line type="monotone" dataKey="fiTarget" stroke={colors.fiTarget} strokeWidth={2} strokeDasharray="6 3" dot={false} name="FI Target" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scenario Comparison Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500 dark:text-neutral-400">
                      <th className="pb-2 pr-4">Metric</th>
                      {scenarioResults.map(s => (
                        <th key={s.name} className="pb-2 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Return Rate', values: scenarioResults.map(s => `${((s.name === 'Pessimistic' ? params.expectedReturn - 0.02 : s.name === 'Optimistic' ? params.expectedReturn + 0.02 : params.expectedReturn) * 100).toFixed(0)}%`) },
                      { label: 'FI Year', values: scenarioResults.map(s => String(s.result.fiYear ?? 'N/A')) },
                      { label: 'Years to FI', values: scenarioResults.map(s => s.result.fiYear ? String(s.result.fiYear - new Date().getFullYear()) : '30+') },
                      { label: 'Final Portfolio', values: scenarioResults.map(s => fmt(s.result.finalPortfolio)) },
                      { label: 'Total Invested', values: scenarioResults.map(s => fmt(s.result.totalInvested)) },
                      { label: 'FI Corpus', values: scenarioResults.map(s => fmt(s.result.finalFITarget)) },
                    ].map(row => (
                      <tr key={row.label} className="border-b border-neutral-50 dark:border-neutral-800">
                        <td className="py-2 pr-4 text-neutral-500 dark:text-neutral-400">{row.label}</td>
                        {row.values.map((v, i) => (
                          <td key={i} className="py-2 pr-4 text-right font-medium">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Monte Carlo Tab ───────────────────────────────── */}
        <TabsContent value="montecarlo" className="mt-4 space-y-6">
          {/* MC Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <Dice5 className="h-3.5 w-3.5" /> Success Rate
                </div>
                <p className={`text-lg font-bold ${monteCarloResult.overallSuccessRate >= 0.8 ? 'text-emerald-600' : monteCarloResult.overallSuccessRate >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
                  {formatPercent(monteCarloResult.overallSuccessRate)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  probability of FI in {params.yearsToProject}y
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <Target className="h-3.5 w-3.5" /> Median FI Year
                </div>
                <p className="text-lg font-bold">{monteCarloResult.medianFIYear ?? 'N/A'}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">50th percentile</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Best Case (p10)
                </div>
                <p className="text-lg font-bold text-emerald-600">{monteCarloResult.p10FIYear ?? 'N/A'}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">optimistic 10th pctl</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 text-xs mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Worst Case (p90)
                </div>
                <p className="text-lg font-bold text-red-600">{monteCarloResult.p90FIYear ?? 'N/A'}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">pessimistic 90th pctl</p>
              </CardContent>
            </Card>
          </div>

          {/* Fan Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monte Carlo Fan Chart</CardTitle>
              <CardDescription>{mcSims} simulations · {(mcStdDev * 100).toFixed(0)}% volatility · Shaded bands show p10-p90 range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mcChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: colors.axis }}
                      interval={Math.floor(params.yearsToProject / 10)}
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
                      contentStyle={{ backgroundColor: colors.tooltip, border: `1px solid ${colors.tooltipBorder}` }}
                    />
                    <Area type="monotone" dataKey="p90" stackId="" fill={isDark ? '#1a3a1a' : '#dcfce7'} stroke="none" fillOpacity={0.4} name="p90 (optimistic)" />
                    <Area type="monotone" dataKey="p75" stackId="" fill={isDark ? '#1a3a2a' : '#bbf7d0'} stroke="none" fillOpacity={0.3} name="p75" />
                    <Area type="monotone" dataKey="p50" stackId="" fill="none" stroke={colors.portfolio} strokeWidth={2} name="Median (p50)" />
                    <Area type="monotone" dataKey="p25" stackId="" fill="none" stroke={isDark ? '#737373' : '#a3a3a3'} strokeWidth={1} strokeDasharray="4 2" name="p25" />
                    <Area type="monotone" dataKey="p10" stackId="" fill={isDark ? '#3a1a1a' : '#fee2e2'} stroke="none" fillOpacity={0.3} name="p10 (pessimistic)" />
                    <Area type="monotone" dataKey="fiTarget" fill="none" stroke={colors.fiTarget} strokeWidth={2} strokeDasharray="6 3" name="FI Target" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* MC Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Simulation Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Return Std Dev (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={Math.round(mcStdDev * 100)}
                    onChange={e => setMcStdDev(Math.max(1, Math.min(50, Number(e.target.value))) / 100)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Simulations</Label>
                  <Input
                    type="number"
                    step="100"
                    value={mcSims}
                    onChange={e => setMcSims(Math.max(100, Math.min(2000, Number(e.target.value))))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-end col-span-2">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 pb-2">
                    Mean return: {(params.expectedReturn * 100).toFixed(0)}% · Volatility: {(mcStdDev * 100).toFixed(0)}% · {mcSims} runs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Success Rate Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">FI Probability Over Time</CardTitle>
              <CardDescription>Cumulative % of simulations that reached FI by each year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monteCarloResult.yearData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: colors.axis }}
                      interval={Math.floor(params.yearsToProject / 10)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: colors.axis }}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      domain={[0, 1]}
                    />
                    <Tooltip
                      formatter={(v: any) => formatPercent(Number(v))}
                      contentStyle={{ backgroundColor: colors.tooltip, border: `1px solid ${colors.tooltipBorder}` }}
                    />
                    <Area type="monotone" dataKey="successRate" fill={isDark ? '#1a3a1a' : '#dcfce7'} stroke="#22c55e" strokeWidth={2} fillOpacity={0.3} name="FI Probability" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
