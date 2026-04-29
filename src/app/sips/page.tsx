'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useMasked } from '@/hooks/useMasked'
import { db, seedDefaultGoals } from '@/lib/db'
import type { SIP } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useConfirm } from '@/hooks/useConfirm'
import { Plus, Trash2, Edit2, RefreshCw, Pause, Play } from 'lucide-react'

export default function SIPsPage() {
  const { fmt } = useMasked()
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const sips = useLiveQuery(() => db.sips.toArray(), [])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SIP | null>(null)
  const [form, setForm] = useState<Omit<SIP, 'id'>>({
    goal: '', instrument: '', amount: 0, dayOfMonth: 1,
    assetClass: 'equity', platform: '', startDate: new Date().toISOString().split('T')[0], active: true,
  })
  const { confirm, confirmProps } = useConfirm()

  useEffect(() => { seedDefaultGoals() }, [])

  const goalList = goals ?? []
  const allSips = sips ?? []
  const activeSips = allSips.filter(s => s.active)
  const pausedSips = allSips.filter(s => !s.active)
  const totalMonthlySIP = activeSips.reduce((s, i) => s + i.amount, 0)
  const totalEquitySIP = activeSips.filter(s => s.assetClass === 'equity').reduce((s, i) => s + i.amount, 0)
  const totalDebtSIP = activeSips.filter(s => s.assetClass !== 'equity').reduce((s, i) => s + i.amount, 0)

  function openAdd() {
    setForm({
      goal: goalList[0]?.name ?? '', instrument: '', amount: 0, dayOfMonth: 1,
      assetClass: 'equity', platform: '', startDate: new Date().toISOString().split('T')[0], active: true,
    })
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(sip: SIP) {
    setForm({ goal: sip.goal, instrument: sip.instrument, amount: sip.amount, dayOfMonth: sip.dayOfMonth,
      assetClass: sip.assetClass, platform: sip.platform, startDate: sip.startDate, active: sip.active })
    setEditing(sip)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.instrument || !form.amount) return
    if (editing?.id) {
      await db.sips.update(editing.id, form)
    } else {
      await db.sips.add({ ...form })
    }
    setShowForm(false)
  }

  async function handleDelete(id: number) {
    const ok = await confirm({ title: 'Delete SIP?', description: 'This SIP entry will be permanently removed.', variant: 'destructive', confirmLabel: 'Delete' })
    if (ok) await db.sips.delete(id)
  }

  async function toggleActive(sip: SIP) {
    if (sip.id) await db.sips.update(sip.id, { active: !sip.active })
  }

  function SIPRow({ sip }: { sip: SIP }) {
    return (
      <tr className="border-b border-neutral-50 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
        <td className="py-2.5 px-4">
          <div className="font-medium">{sip.instrument}</div>
          {sip.platform && <div className="text-xs text-neutral-400 dark:text-neutral-500">{sip.platform}</div>}
        </td>
        <td className="py-2.5 px-2"><Badge variant={sip.goal.toLowerCase() === 'retirement' ? 'success' : sip.goal.toLowerCase() === 'emergency' ? 'warning' : 'default'}>{sip.goal}</Badge></td>
        <td className="py-2.5 px-2"><Badge variant={sip.assetClass === 'equity' ? 'success' : 'default'}>{sip.assetClass}</Badge></td>
        <td className="py-2.5 px-2 text-right font-medium">{fmt(sip.amount)}</td>
        <td className="py-2.5 px-2 text-center text-neutral-500 dark:text-neutral-400">{sip.dayOfMonth}</td>
        <td className="py-2.5 px-2 text-center">
          {sip.active
            ? <Badge variant="success">Active</Badge>
            : <Badge variant="danger">Paused</Badge>}
        </td>
        <td className="py-2.5 px-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => toggleActive(sip)} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800" title={sip.active ? 'Pause' : 'Resume'}>
              {sip.active ? <Pause className="h-3.5 w-3.5 text-amber-500" /> : <Play className="h-3.5 w-3.5 text-emerald-500" />}
            </button>
            <button onClick={() => openEdit(sip)} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <Edit2 className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
            </button>
            <button onClick={() => sip.id && handleDelete(sip.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950">
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SIP Tracker</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Manage your Systematic Investment Plans</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add SIP</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Monthly SIP Total</p>
            <p className="text-xl font-bold">{fmt(totalMonthlySIP)}</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{activeSips.length} active SIPs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Equity SIPs</p>
            <p className="text-xl font-bold">{fmt(totalEquitySIP)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Debt / Fixed SIPs</p>
            <p className="text-xl font-bold">{fmt(totalDebtSIP)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {allSips.length === 0 ? (
            <EmptyState
              icon={<RefreshCw className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />}
              title="No SIPs yet"
              description="Add your monthly Systematic Investment Plans to track commitments."
              actionLabel="Add SIP"
              onAction={openAdd}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Instrument</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Goal</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Class</th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Amount</th>
                    <th className="text-center py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Day</th>
                    <th className="text-center py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Status</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {activeSips.map(sip => <SIPRow key={sip.id} sip={sip} />)}
                  {pausedSips.length > 0 && activeSips.length > 0 && (
                    <tr><td colSpan={7} className="py-2 px-4 text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-800">Paused</td></tr>
                  )}
                  {pausedSips.map(sip => <SIPRow key={sip.id} sip={sip} />)}
                </tbody>
                <tfoot>
                  <tr className="font-medium bg-neutral-50/50 dark:bg-neutral-800/50">
                    <td className="py-3 px-4" colSpan={3}>Active Total</td>
                    <td className="py-3 px-2 text-right">{fmt(totalMonthlySIP)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit SIP' : 'Add SIP'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Goal</Label>
              <Select value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })}>
                {goalList.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Asset Class</Label>
              <Select value={form.assetClass} onChange={e => setForm({ ...form, assetClass: e.target.value as any })}>
                <option value="equity">Equity</option>
                <option value="debt">Debt</option>
                <option value="fixed">Fixed Income</option>
                <option value="epf">EPF</option>
                <option value="ppf">PPF</option>
                <option value="nps">NPS</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Fund / Instrument Name</Label>
            <Input value={form.instrument} onChange={e => setForm({ ...form, instrument: e.target.value })} placeholder="e.g., Mirae Asset Large Cap Fund" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Monthly Amount</Label>
              <Input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>SIP Day (1-28)</Label>
              <Input type="number" min="1" max="28" value={form.dayOfMonth} onChange={e => setForm({ ...form, dayOfMonth: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Platform</Label>
            <Input value={form.platform || ''} onChange={e => setForm({ ...form, platform: e.target.value })} placeholder="e.g., Groww, Zerodha Coin" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}
