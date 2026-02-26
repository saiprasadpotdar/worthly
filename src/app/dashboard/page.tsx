'use client'

import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/lib/db'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  calculateLeanFI,
  calculateRegularFI,
  calculateFatFI,
  calculateFIProgress,
  calculateYearsToFI,
  calculateSavedYears,
  calculateRatios,
} from '@/lib/calculations/fi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TrendingUp, Target, PiggyBank, Shield, ArrowUpRight, ArrowDownRight, Wallet, Landmark, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#171717', '#525252', '#a3a3a3', '#d4d4d4']

export default function DashboardPage() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const loans = useLiveQuery(() => db.loans.toArray(), [])
  const properties = useLiveQuery(() => db.properties.toArray(), [])
  const snapshots = useLiveQuery(() => db.netWorthSnapshots.orderBy('year').toArray(), [])
  const annualIncomes = useLiveQuery(() => db.annualIncomes.orderBy('year').toArray(), [])

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
  const totalDebt = inv.filter(i => i.assetClass === 'debt' || i.assetClass === 'fixed').reduce((s, i) => s + i.currentValue, 0)
  const totalLiquid = inv.reduce((s, i) => s + i.currentValue, 0)
  const totalRealAssets = props.reduce((s, p) => s + p.currentMarketValue, 0)
  const totalLiabilities = lns.reduce((s, l) => s + l.balance, 0)
  const netWorth = totalLiquid + totalRealAssets - totalLiabilities

  const monthlyExpenses = profile.monthlyExpenses || 60000
  const annualExpenses = monthlyExpenses * 12
  const leanFI = calculateLeanFI(annualExpenses)
  const regularFI = calculateRegularFI(leanFI)
  const fatFI = calculateFatFI(regularFI)

  const retirementInv = inv.filter(i => i.category === 'retirement')
  const retirementCorpus = retirementInv.reduce((s, i) => s + i.currentValue, 0)
  const emergencyInv = inv.filter(i => i.category === 'emergency')
  const emergencyFund = emergencyInv.reduce((s, i) => s + i.currentValue, 0)

  const fiProgress = calculateFIProgress(retirementCorpus, leanFI)
  const yearsToFI = calculateYearsToFI(retirementCorpus, leanFI, profile.monthlyExpenses ? (profile as any).monthlySavings || 50000 : 50000)
  const savedYears = calculateSavedYears(retirementCorpus, monthlyExpenses)

  const dashData = {
    totalEquity, totalDebt, totalLiquidAssets: totalLiquid, totalRealAssets: totalRealAssets,
    totalMetals: 0, totalLiabilities, netWorth, monthlyIncome: 0, monthlySavings: 0,
    monthlyEmi: profile.monthlyEmi || 0, leanFITarget: leanFI, regularFITarget: regularFI,
    fatFITarget: fatFI, retirementCorpus, emergencyFund, fiProgress,
  }
  const ratios = calculateRatios(dashData)

  const allocationData = [
    { name: 'Equity', value: totalEquity },
    { name: 'Debt', value: totalDebt },
    { name: 'Real Assets', value: totalRealAssets },
  ].filter(d => d.value > 0)

  const netWorthData = snaps.map(s => ({
    year: s.year,
    assets: s.yearEndAssets,
    liabilities: s.liabilities,
    netWorth: s.netWorth,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-neutral-500 text-sm mt-1">Your financial independence at a glance</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Net Worth</span>
              <div className="rounded-full bg-neutral-100 p-2"><TrendingUp className="h-4 w-4 text-neutral-600" /></div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(netWorth, true)}</p>
            <p className="text-xs text-neutral-400 mt-1">Assets - Liabilities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Retirement Corpus</span>
              <div className="rounded-full bg-neutral-100 p-2"><Target className="h-4 w-4 text-neutral-600" /></div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(retirementCorpus, true)}</p>
            <p className="text-xs text-neutral-400 mt-1">{formatPercent(fiProgress)} of Lean FI</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Emergency Fund</span>
              <div className="rounded-full bg-neutral-100 p-2"><Shield className="h-4 w-4 text-neutral-600" /></div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(emergencyFund, true)}</p>
            <p className="text-xs text-neutral-400 mt-1">{(emergencyFund / monthlyExpenses).toFixed(1)} months covered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Years Saved</span>
              <div className="rounded-full bg-neutral-100 p-2"><PiggyBank className="h-4 w-4 text-neutral-600" /></div>
            </div>
            <p className="text-2xl font-bold">{savedYears.toFixed(1)}</p>
            <p className="text-xs text-neutral-400 mt-1">Of expenses covered</p>
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
              <span>Lean FI <span className="text-neutral-400">({formatCurrency(leanFI, true)})</span></span>
              <span className="font-medium">{formatPercent(fiProgress)}</span>
            </div>
            <Progress value={fiProgress * 100} indicatorClassName="bg-emerald-500" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Regular FI <span className="text-neutral-400">({formatCurrency(regularFI, true)})</span></span>
              <span className="font-medium">{formatPercent(calculateFIProgress(retirementCorpus, regularFI))}</span>
            </div>
            <Progress value={calculateFIProgress(retirementCorpus, regularFI) * 100} indicatorClassName="bg-blue-500" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Fat FI <span className="text-neutral-400">({formatCurrency(fatFI, true)})</span></span>
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
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="assets" stackId="1" fill="#d4d4d4" stroke="#a3a3a3" name="Assets" />
                  <Area type="monotone" dataKey="netWorth" fill="#171717" stroke="#171717" fillOpacity={0.1} name="Net Worth" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">Add net worth snapshots to see trends</p>
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
                      {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {allocationData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm">{d.name}</span>
                      <span className="text-sm font-medium ml-auto">{formatCurrency(d.value, true)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">Add investments to see allocation</p>
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
              { label: 'Liquid Assets / NW', current: ratios.liquidToNW, desired: profile.desiredLiquidToNW },
              { label: 'Real Assets / NW', current: ratios.realToNW, desired: profile.desiredRealToNW },
              { label: 'Savings / Income', current: ratios.savingsToIncome, desired: profile.desiredSavingsToIncome },
              { label: 'Loan / Assets', current: ratios.loanToAsset, desired: profile.desiredLoanToAsset },
            ].map(r => (
              <div key={r.label} className="space-y-1">
                <p className="text-xs text-neutral-500">{r.label}</p>
                <p className="text-lg font-semibold">{formatPercent(r.current)}</p>
                <p className="text-xs text-neutral-400">Target: {formatPercent(r.desired || 0)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/networth', label: 'Manage Assets', desc: 'Add or update investments', icon: TrendingUp },
          { href: '/income', label: 'Track Income', desc: 'Log your earnings', icon: Wallet },
          { href: '/liabilities', label: 'View Loans', desc: 'Monitor your debt', icon: Landmark },
        ].map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-full bg-neutral-100 p-2.5"><Icon className="h-5 w-5 text-neutral-600" /></div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-neutral-400">{desc}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-neutral-300 ml-auto" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
