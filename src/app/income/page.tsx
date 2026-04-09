'use client'

import { useState } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useMasked } from '@/hooks/useMasked'
import { useApp } from '@/context/app-context'
import { db } from '@/lib/db'
import { formatPercent, getChartColors } from '@/lib/utils'
import type { AnnualIncome } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, Trash2, Edit2, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function IncomePage() {
  const { fmt: formatCurrency } = useMasked()
  const { isDark } = useApp()
  const colors = getChartColors(isDark)
  const annualIncomes = useLiveQuery(() => db.annualIncomes.orderBy('year').toArray(), [])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AnnualIncome | null>(null)
  const [form, setForm] = useState({ year: '', grossSalary: 0, taxes: 0, netIncome: 0 })

  const incomes = annualIncomes ?? []
  const latest = incomes[incomes.length - 1]
  const previous = incomes[incomes.length - 2]
  const growth = latest && previous && previous.netIncome > 0
    ? (latest.netIncome - previous.netIncome) / previous.netIncome
    : 0

  function openAdd() {
    const currentFY = new Date().getMonth() >= 3
      ? `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}`
      : `${new Date().getFullYear() - 1}-${new Date().getFullYear().toString().slice(2)}`
    setForm({ year: currentFY, grossSalary: 0, taxes: 0, netIncome: 0 })
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(item: AnnualIncome) {
    setForm({ year: item.year, grossSalary: item.grossSalary, taxes: item.taxes, netIncome: item.netIncome })
    setEditing(item)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.year) return
    const data = { ...form, netIncome: form.grossSalary - form.taxes }
    if (editing?.id) {
      await db.annualIncomes.update(editing.id, data)
    } else {
      await db.annualIncomes.add(data)
    }
    setShowForm(false)
  }

  async function handleDelete(id: number) {
    await db.annualIncomes.delete(id)
  }

  const chartData = incomes.map(i => ({
    year: i.year,
    gross: i.grossSalary,
    taxes: i.taxes,
    net: i.netIncome,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Income</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Track your annual income and growth</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Year</Button>
      </div>

      {incomes.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />}
          title="No income data yet"
          description="Start tracking your annual income to see growth trends over time."
          actionLabel="Add Income Year"
          onAction={openAdd}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Latest Net Income</p>
                <p className="text-xl font-bold">{latest ? formatCurrency(latest.netIncome, true) : '—'}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{latest?.year}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">YoY Growth</p>
                <div className="flex items-center gap-2">
                  <p className={`text-xl font-bold ${growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {growth >= 0 ? '+' : ''}{formatPercent(growth)}
                  </p>
                  {growth >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Effective Tax Rate</p>
                <p className="text-xl font-bold">
                  {latest && latest.grossSalary > 0 ? formatPercent(latest.taxes / latest.grossSalary) : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="net" fill={colors.bar1} radius={[4, 4, 0, 0]} name="Net Income" />
                  <Bar dataKey="taxes" fill={colors.bar2} radius={[4, 4, 0, 0]} name="Taxes" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Annual Income History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-neutral-800">
                      <th className="text-left py-2 font-medium text-neutral-500 dark:text-neutral-400">Year</th>
                      <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">Gross Salary</th>
                      <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">Taxes</th>
                      <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">Net Income</th>
                      <th className="text-right py-2 font-medium text-neutral-500 dark:text-neutral-400">Growth</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomes.map((item, idx) => {
                      const prev = idx > 0 ? incomes[idx - 1] : null
                      const g = prev && prev.netIncome > 0 ? (item.netIncome - prev.netIncome) / prev.netIncome : 0
                      return (
                        <tr key={item.id} className="border-b border-neutral-50 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                          <td className="py-2.5 font-medium">{item.year}</td>
                          <td className="py-2.5 text-right">{formatCurrency(item.grossSalary)}</td>
                          <td className="py-2.5 text-right text-neutral-500 dark:text-neutral-400">{formatCurrency(item.taxes)}</td>
                          <td className="py-2.5 text-right font-medium">{formatCurrency(item.netIncome)}</td>
                          <td className={`py-2.5 text-right ${g >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {idx === 0 ? '—' : `${g >= 0 ? '+' : ''}${formatPercent(g)}`}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                                <Edit2 className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
                              </button>
                              <button onClick={() => item.id && handleDelete(item.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950">
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Income Year' : 'Add Income Year'}>
        <div className="space-y-4">
          <div>
            <Label>Financial Year</Label>
            <Input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="e.g., 2024-25" />
          </div>
          <div>
            <Label>Gross Salary (Annual)</Label>
            <Input type="number" value={form.grossSalary || ''} onChange={e => setForm({ ...form, grossSalary: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Taxes (Annual)</Label>
            <Input type="number" value={form.taxes || ''} onChange={e => setForm({ ...form, taxes: Number(e.target.value) })} />
          </div>
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-3">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Net Income: <span className="font-medium text-neutral-900 dark:text-white">{formatCurrency(form.grossSalary - form.taxes)}</span></p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
