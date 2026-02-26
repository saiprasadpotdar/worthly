'use client'

import { useState } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import type { Investment } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, Trash2, TrendingUp, Edit2 } from 'lucide-react'

const emptyInvestment: Omit<Investment, 'id'> = {
  category: 'retirement',
  assetClass: 'equity',
  instrument: '',
  investedValue: 0,
  currentValue: 0,
  startDate: new Date().toISOString().split('T')[0],
  platform: '',
}

export default function NetWorthPage() {
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [form, setForm] = useState(emptyInvestment)

  const inv = investments ?? []
  const retirement = inv.filter(i => i.category === 'retirement')
  const emergency = inv.filter(i => i.category === 'emergency')

  const totalInvested = inv.reduce((s, i) => s + i.investedValue, 0)
  const totalCurrent = inv.reduce((s, i) => s + i.currentValue, 0)
  const totalPL = totalCurrent - totalInvested

  function openAdd() {
    setForm(emptyInvestment)
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(item: Investment) {
    setForm({
      category: item.category,
      assetClass: item.assetClass,
      instrument: item.instrument,
      investedValue: item.investedValue,
      currentValue: item.currentValue,
      startDate: item.startDate,
      platform: item.platform,
    })
    setEditing(item)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.instrument) return
    if (editing?.id) {
      await db.investments.update(editing.id, form)
    } else {
      await db.investments.add({ ...form })
    }
    setShowForm(false)
  }

  async function handleDelete(id: number) {
    await db.investments.delete(id)
  }

  function InvestmentTable({ items, title }: { items: Investment[]; title: string }) {
    const equity = items.filter(i => i.assetClass === 'equity')
    const debt = items.filter(i => i.assetClass === 'debt' || i.assetClass === 'fixed')

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge>{items.length} instruments</Badge>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-6">No investments yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="text-left py-2 font-medium text-neutral-500">Instrument</th>
                    <th className="text-left py-2 font-medium text-neutral-500">Class</th>
                    <th className="text-right py-2 font-medium text-neutral-500">Invested</th>
                    <th className="text-right py-2 font-medium text-neutral-500">Current</th>
                    <th className="text-right py-2 font-medium text-neutral-500">P&L</th>
                    <th className="text-right py-2 font-medium text-neutral-500">Weight</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const pl = item.currentValue - item.investedValue
                    const total = items.reduce((s, i) => s + i.currentValue, 0)
                    const weight = total > 0 ? item.currentValue / total : 0
                    return (
                      <tr key={item.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                        <td className="py-2.5 font-medium">{item.instrument}</td>
                        <td className="py-2.5">
                          <Badge variant={item.assetClass === 'equity' ? 'default' : 'success'}>
                            {item.assetClass}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">{formatCurrency(item.investedValue)}</td>
                        <td className="py-2.5 text-right font-medium">{formatCurrency(item.currentValue)}</td>
                        <td className={`py-2.5 text-right ${pl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                        </td>
                        <td className="py-2.5 text-right text-neutral-500">{(weight * 100).toFixed(1)}%</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-neutral-100">
                              <Edit2 className="h-3.5 w-3.5 text-neutral-400" />
                            </button>
                            <button onClick={() => item.id && handleDelete(item.id)} className="p-1 rounded hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className="py-2.5" colSpan={2}>Total</td>
                    <td className="py-2.5 text-right">{formatCurrency(items.reduce((s, i) => s + i.investedValue, 0))}</td>
                    <td className="py-2.5 text-right">{formatCurrency(items.reduce((s, i) => s + i.currentValue, 0))}</td>
                    <td className={`py-2.5 text-right ${items.reduce((s, i) => s + (i.currentValue - i.investedValue), 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(items.reduce((s, i) => s + (i.currentValue - i.investedValue), 0))}
                    </td>
                    <td className="py-2.5 text-right">100%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Net Worth</h1>
          <p className="text-neutral-500 text-sm mt-1">Track your investments and assets</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Investment</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 mb-1">Total Invested</p>
            <p className="text-xl font-bold">{formatCurrency(totalInvested, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 mb-1">Current Value</p>
            <p className="text-xl font-bold">{formatCurrency(totalCurrent, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 mb-1">Total P&L</p>
            <p className={`text-xl font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL, true)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="retirement">
        <TabsList>
          <TabsTrigger value="retirement">Retirement</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
        </TabsList>
        <TabsContent value="retirement" className="mt-4">
          <InvestmentTable items={retirement} title="Retirement Portfolio" />
        </TabsContent>
        <TabsContent value="emergency" className="mt-4">
          <InvestmentTable items={emergency} title="Emergency Fund" />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Investment' : 'Add Investment'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })}>
                <option value="retirement">Retirement</option>
                <option value="emergency">Emergency</option>
              </Select>
            </div>
            <div>
              <Label>Asset Class</Label>
              <Select value={form.assetClass} onChange={e => setForm({ ...form, assetClass: e.target.value as any })}>
                <option value="equity">Equity</option>
                <option value="debt">Debt</option>
                <option value="fixed">Fixed Income</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Instrument Name</Label>
            <Input value={form.instrument} onChange={e => setForm({ ...form, instrument: e.target.value })} placeholder="e.g., Zerodha, PPF, Mirae Large & Mid" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invested Value</Label>
              <Input type="number" value={form.investedValue || ''} onChange={e => setForm({ ...form, investedValue: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Current Value</Label>
              <Input type="number" value={form.currentValue || ''} onChange={e => setForm({ ...form, currentValue: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>Platform</Label>
              <Input value={form.platform || ''} onChange={e => setForm({ ...form, platform: e.target.value })} placeholder="e.g., Zerodha, Groww" />
            </div>
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
