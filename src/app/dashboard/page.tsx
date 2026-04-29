'use client'

import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useMasked } from '@/hooks/useMasked'
import { db } from '@/lib/db'
import { formatPercent, getChartColors } from '@/lib/utils'
import { useApp } from '@/context/app-context'
import {
  calculateFIProgress,
  calculateYearsToFI,
  calculateSavedYears,
  calculateRatios,
} from '@/lib/calculations/fi'
import { calculateCoastFI } from '@/lib/calculations/coast-fi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TrendingUp, Target, PiggyBank, Shield, ArrowUpRight, ArrowDownRight, Wallet, Landmark, LayoutDashboard, AlertTriangle, Trophy, Compass, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import { useEffect, useState, useMemo } from 'react'
import { seedDefaultMilestones } from '@/lib/db'

const ALLOCATION_COLORS: Record<string, string> = {
  Equity: '#10b981',    // emerald-500
  Debt: '#3b82f6',      // blue-500
  'Real Estate': '#f59e0b', // amber-500
}

export default function DashboardPage() {
  const { isDark } = useApp()
  const colors = getChartColors(isDark)
  const COLORS = colors.pie
  const { fmt: formatCurrency } = useMasked()
  const profile = useLiveQuery(() => db.userProfile.toCollection().first(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const loans = useLiveQuery(() => db.loans.toArray(), [])
  const properties = useLiveQuery(() => db.properties.toArray(), [])
  const snapshots = useLiveQuery(() => db.netWorthSnapshots.orderBy('date').toArray(), [])
  const annualIncomes = useLiveQuery(() => db.annualIncomes.orderBy('year').toArray(), [])
  const milestones = useLiveQuery(() => db.milestones.toArray(), [])
  const sips = useLiveQuery(() => db.sips.toArray(), [])

  useEffect(() => { seedDefaultMilestones() }, [])

  // Read assumption params from projections localStorage (return/inflation are
  // tweaked on the projections page, not in Settings).
  const projectionParams = useMemo(() => {
    if (typeof window === 'undefined') return { expectedReturn: 0.12, expenseInflation: 0.07 }
    try {
      const saved = localStorage.getItem('worthly-projection-params')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          expectedReturn: parsed.expectedReturn ?? 0.12,
          expenseInflation: parsed.expenseInflation ?? 0.07,
        }
      }
    } catch {}
    return { expectedReturn: 0.12, expenseInflation: 0.07 }
  }, [])

  if (!profile) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <EmptyState
          icon={<LayoutDashboard className="h-6 w-6 text-neutral-400" />}
          title="Welcome to Worthly"
          description="Get started by setting up your profile in Settings, then add your assets and liabilities."
          actionLabel="Go to Settings"
          onAction={() => window.location.href = '/settings'}
        />
      </div>
    )
  }

  const inv = investments ?? []
  const lns = loans ?? []
  const props = properties ?? []
  const snaps = snapshots ?? []

  const totalEquity = inv.filter(i => i.assetClass === 'equity').reduce((s, i) => s + i.currentValue, 0)
  const totalDebt = inv.filter(i => ['debt', 'fixed', 'epf', 'ppf', 'nps'].includes(i.assetClass)).reduce((s, i) => s + i.currentValue, 0)
  const totalLiquid = inv.filter(i => i.assetClass !== 'real_estate').reduce((s, i) => s + i.currentValue, 0)
  const totalInvRealEstate = inv.filter(i => i.assetClass === 'real_estate').reduce((s, i) => s + i.currentValue, 0)
  const totalRealAssets = props.reduce((s, p) => s + p.currentMarketValue, 0) + totalInvRealEstate
  const totalAssets = totalLiquid + totalRealAssets
  const propertyMortgages = props.reduce((s, p) => s + (p.outstandingPrincipal || 0), 0)
  const totalLiabilities = lns.reduce((s, l) => s + l.balance, 0) + propertyMortgages
  const netWorth = totalAssets - totalLiabilities

  const monthlyExpenses = profile.monthlyExpenses || 60000
  const annualExpenses = monthlyExpenses * 12

  const fiMultiplier = profile.fiMultiplier ?? 25
  const regularFI = annualExpenses * fiMultiplier
  const leanFI = regularFI * 0.5
  const fatFI = regularFI * 2

  const goalList = goals ?? []
  const retirementInv = inv.filter(i => i.goal?.toLowerCase() === 'retirement')
  const retirementCorpus = retirementInv.reduce((s, i) => s + i.currentValue, 0)
  const emergencyInv = inv.filter(i => i.goal?.toLowerCase() === 'emergency')
  const emergencyFund = emergencyInv.reduce((s, i) => s + i.currentValue, 0)

  // Derive income & savings
  const incomes = annualIncomes ?? []
  const latestIncome = incomes[incomes.length - 1]
  const annualNetIncome = latestIncome ? latestIncome.netIncome : 0
  const monthlyIncome = annualNetIncome / 12
  const monthlyEmi = profile.monthlyEmi || 0
  const monthlySavings = monthlyIncome > 0 ? monthlyIncome - monthlyExpenses - monthlyEmi : 0

  // Annual SIP amount for savings ratio
  const activeSips = (sips ?? []).filter(s => s.active)
  const totalMonthlySIP = activeSips.reduce((s, i) => s + i.amount, 0)
  const annualSIP = totalMonthlySIP * 12

  const fiProgress = calculateFIProgress(retirementCorpus, leanFI)
  const yearsToFI = calculateYearsToFI(retirementCorpus, leanFI, monthlySavings > 0 ? monthlySavings : 50000)
  const savedYears = calculateSavedYears(retirementCorpus, monthlyExpenses)

  const dashData = {
    totalEquity, totalDebt, totalLiquidAssets: totalLiquid, totalRealAssets,
    totalMetals: 0, totalLiabilities, netWorth, monthlyIncome, monthlySavings,
    monthlyEmi, leanFITarget: leanFI, regularFITarget: regularFI,
    fatFITarget: fatFI, retirementCorpus, emergencyFund, fiProgress,
  }
  const ratios = calculateRatios(dashData)

  // Override savings ratio = annual SIP / net annual income
  const savingsToIncome = annualNetIncome > 0 ? annualSIP / annualNetIncome : 0
  // Loan-to-asset ratio (lower is better)
  const loanToAsset = totalAssets > 0 ? totalLiabilities / totalAssets : 0

  const allocationData = [
    { name: 'Equity', value: totalEquity },
    { name: 'Debt', value: totalDebt },
    { name: 'Real Estate', value: totalRealAssets },
  ].filter(d => d.value > 0)

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const netWorthData = snaps.map(s => ({
    label: `${MONTHS[(s.month || 1) - 1]} ${String(s.year).slice(2)}`,
    assets: s.totalAssets,
    liabilities: s.totalLiabilities,
    netWorth: s.netWorth,
  }))

  // Rebalancing alerts
  const actualEquityRatio = (totalEquity + totalDebt) > 0 ? totalEquity / (totalEquity + totalDebt) : 0
  const desiredEquity = profile.desiredEquityRatio || 0.7
  const equityDrift = Math.abs(actualEquityRatio - desiredEquity)
  const rebalanceNeeded = equityDrift > 0.05 // >5% drift

  // Milestones — based on live total assets
  const mstones = milestones ?? []
  const nextMilestone = mstones.filter(m => totalAssets < m.amount).sort((a, b) => a.amount - b.amount)[0]
  const lastAchieved = mstones.filter(m => totalAssets >= m.amount).sort((a, b) => b.amount - a.amount)[0]

  // Coast FI summary (1.7)
  const retirementAge = profile.retirementAge ?? 50
  const currentAge = profile.birthYear ? new Date().getFullYear() - profile.birthYear : null
  const yearsToRetirement = currentAge ? Math.max(0, retirementAge - currentAge) : 20
  const coastFI = calculateCoastFI(regularFI, retirementCorpus, projectionParams.expectedReturn, projectionParams.expenseInflation, yearsToRetirement)

  // Portfolio P&L (1.10)
  const totalInvested = inv.reduce((s, i) => s + i.investedValue, 0)
  const totalCurrent = inv.reduce((s, i) => s + i.currentValue, 0)
  const portfolioPL = totalCurrent - totalInvested
  const portfolioPLPercent = totalInvested > 0 ? portfolioPL / totalInvested : 0

  // Income trend sparkline data (1.12) — last 5 years
  const incomeTrendData = incomes.slice(-5).map(i => ({
    year: i.year,
    income: i.netIncome,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Your financial independence at a glance</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Net Worth</span>
              <div className="rounded-full bg-neutral-100 dark:bg-neutral-800 p-2"><TrendingUp className="h-4 w-4 text-neutral-600 dark:text-neutral-400" /></div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(netWorth, true)}</p>
            {totalInvested > 0 && (
              <p className={`text-xs mt-1 ${portfolioPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                P&L: {portfolioPL >= 0 ? '+' : ''}{formatCurrency(portfolioPL, true)} ({portfolioPL >= 0 ? '+' : ''}{formatPercent(portfolioPLPercent)})
              </p>
            )}
            {totalInvested === 0 && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Assets - Liabilities</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Retirement Corpus</span>
              <div className="rounded-full bg-neutral-100 dark:bg-neutral-800 p-2"><Target className="h-4 w-4 text-neutral-600 dark:text-neutral-400" /></div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(retirementCorpus, true)}</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{formatPercent(fiProgress)} of Lean FI</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Emergency Fund</span>
              <div className="rounded-full bg-neutral-100 dark:bg-neutral-800 p-2"><Shield className="h-4 w-4 text-neutral-600 dark:text-neutral-400" /></div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(emergencyFund, true)}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-neutral-400 dark:text-neutral-500">{monthlyExpenses > 0 ? (emergencyFund / monthlyExpenses).toFixed(1) : '0'} months covered</p>
              <Badge variant={monthlyExpenses > 0 && emergencyFund / monthlyExpenses >= 6 ? 'success' : monthlyExpenses > 0 && emergencyFund / monthlyExpenses >= 3 ? 'warning' : 'danger'}>
                {monthlyExpenses > 0 && emergencyFund / monthlyExpenses >= 6 ? 'Healthy' : monthlyExpenses > 0 && emergencyFund / monthlyExpenses >= 3 ? 'Adequate' : 'Low'}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Years to FI</span>
              <div className="rounded-full bg-neutral-100 dark:bg-neutral-800 p-2"><Target className="h-4 w-4 text-neutral-600 dark:text-neutral-400" /></div>
            </div>
            <p className="text-2xl font-bold">
              {!isFinite(yearsToFI) || isNaN(yearsToFI) ? '∞' : yearsToFI <= 0 ? 'Achieved!' : yearsToFI.toFixed(1)}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{savedYears.toFixed(1)} years of expenses saved</p>
          </CardContent>
        </Card>
      </div>

      {/* FI Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">FI Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Lean FI ({fiMultiplier * 0.5}x) <span className="text-neutral-400 dark:text-neutral-500">({formatCurrency(leanFI, true)})</span></span>
              <span className="font-medium">{formatPercent(fiProgress)}</span>
            </div>
            <Progress value={fiProgress * 100} indicatorClassName="bg-emerald-500" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Regular FI ({fiMultiplier}x) <span className="text-neutral-400 dark:text-neutral-500">({formatCurrency(regularFI, true)})</span></span>
              <span className="font-medium">{formatPercent(calculateFIProgress(retirementCorpus, regularFI))}</span>
            </div>
            <Progress value={calculateFIProgress(retirementCorpus, regularFI) * 100} indicatorClassName="bg-blue-500" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Fat FI ({fiMultiplier * 2}x) <span className="text-neutral-400 dark:text-neutral-500">({formatCurrency(fatFI, true)})</span></span>
              <span className="font-medium">{formatPercent(calculateFIProgress(retirementCorpus, fatFI))}</span>
            </div>
            <Progress value={calculateFIProgress(retirementCorpus, fatFI) * 100} indicatorClassName="bg-purple-500" />
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Net Worth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Worth Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {netWorthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={netWorthData}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="assets" stackId="1" fill={colors.assetsFill} stroke={colors.assets} name="Assets" />
                  <Area type="monotone" dataKey="liabilities" fill={colors.liabilitiesFill} stroke={colors.liabilities} fillOpacity={0.4} name="Liabilities" />
                  <Area type="monotone" dataKey="netWorth" fill={colors.netWorthFill} stroke={colors.netWorth} fillOpacity={0.1} name="Net Worth" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">Add net worth snapshots to see trends</p>
            )}
          </CardContent>
        </Card>

        {/* Allocation Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {allocationData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {allocationData.map((d, i) => <Cell key={i} fill={ALLOCATION_COLORS[d.name] || COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {allocationData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: ALLOCATION_COLORS[d.name] || COLORS[i % COLORS.length] }} />
                      <span className="text-sm">{d.name}</span>
                      <span className="text-sm font-medium ml-auto">{formatCurrency(d.value, true)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">Add investments to see allocation</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ratios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financial Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Liquid Assets / NW', current: ratios.liquidToNW, desired: profile.desiredLiquidToNW, lowerBetter: false },
              { label: 'Real Assets / NW', current: ratios.realToNW, desired: profile.desiredRealToNW, lowerBetter: false },
              { label: 'SIP / Income', current: savingsToIncome, desired: profile.desiredSavingsToIncome, lowerBetter: false },
              { label: 'Loan / Assets', current: loanToAsset, desired: profile.desiredLoanToAsset, lowerBetter: true },
            ].map(r => {
              const isGood = r.lowerBetter
                ? r.current <= (r.desired || 0.3)
                : r.current >= (r.desired || 0)
              return (
                <div key={r.label} className="space-y-1">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{r.label}</p>
                  <p className={`text-lg font-semibold ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPercent(r.current)}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    Target: {formatPercent(r.desired || 0)}
                    {r.lowerBetter && <span className="ml-1 text-neutral-300 dark:text-neutral-600">(lower is better)</span>}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Coast FI Summary (1.7) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Coast FI Progress</span>
            </div>
            <Badge variant={coastFI.coastFIReached ? 'success' : 'warning'}>
              {coastFI.coastFIReached ? 'Reached!' : 'In Progress'}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600 dark:text-neutral-300">{formatCurrency(retirementCorpus, true)} current</span>
                <span className="font-medium">{formatCurrency(coastFI.coastFITarget, true)} target</span>
              </div>
              <Progress value={coastFI.coastFIProgress * 100} className="h-2" indicatorClassName="bg-blue-500" />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {(coastFI.coastFIProgress * 100).toFixed(1)}% · Retire by {retirementAge}{currentAge ? ` (${yearsToRetirement}y away)` : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts & Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rebalancing Alert */}
        <Card className={rebalanceNeeded ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/30' : ''}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              {rebalanceNeeded ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <Target className="h-4 w-4 text-emerald-600" />}
              <span className="text-sm font-medium">{rebalanceNeeded ? 'Rebalancing Needed' : 'Allocation On Track'}</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Equity: {formatPercent(actualEquityRatio)} (target {formatPercent(desiredEquity)})
              {' · '}Debt: {formatPercent(1 - actualEquityRatio)} (target {formatPercent(profile.desiredDebtRatio || (1 - desiredEquity))})
            </p>
            {rebalanceNeeded && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                {actualEquityRatio > desiredEquity
                  ? `Consider moving ${formatCurrency((actualEquityRatio - desiredEquity) * (totalEquity + totalDebt), true)} from equity to debt`
                  : `Consider moving ${formatCurrency((desiredEquity - actualEquityRatio) * (totalEquity + totalDebt), true)} from debt to equity`
                }
              </p>
            )}
          </CardContent>
        </Card>

        {/* Next Milestone */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <span className="text-sm font-medium">Milestone Progress</span>
            </div>
            {nextMilestone ? (
              <>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  {lastAchieved ? `Reached ${lastAchieved.label} · ` : ''}Next: {nextMilestone.label}
                </p>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-neutral-800 dark:bg-white transition-all"
                    style={{ width: `${Math.min(totalAssets / nextMilestone.amount, 1) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{formatPercent(totalAssets / nextMilestone.amount)}</p>
              </>
            ) : (
              <p className="text-xs text-emerald-600 font-medium">All milestones achieved!</p>
            )}
          </CardContent>
        </Card>

        {/* SIP Summary */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <span className="text-sm font-medium">Monthly SIPs</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(totalMonthlySIP)}</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {activeSips.length} active SIP{activeSips.length !== 1 ? 's' : ''} · {formatCurrency(totalMonthlySIP * 12, true)}/year
            </p>
          </CardContent>
        </Card>

        {/* Income Trend Sparkline (1.12) */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <span className="text-sm font-medium">Income Trend</span>
            </div>
            {incomeTrendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={incomeTrendData}>
                  <Tooltip formatter={(v) => formatCurrency(Number(v), true)} />
                  <Bar dataKey="income" fill={colors.bar1} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-500">Add income data to see trends</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/networth', label: 'Manage Assets', desc: 'Add or update investments', icon: TrendingUp },
          { href: '/income', label: 'Track Income', desc: 'Log your earnings', icon: Wallet },
          { href: '/liabilities', label: 'View Loans', desc: 'Monitor your debt', icon: Landmark },
        ].map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-full bg-neutral-100 dark:bg-neutral-800 p-2.5"><Icon className="h-5 w-5 text-neutral-600 dark:text-neutral-400" /></div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{desc}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-neutral-300 dark:text-neutral-600 ml-auto" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
