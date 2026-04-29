'use client'

import { useState, useMemo } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/lib/db'
import { useMasked } from '@/hooks/useMasked'
import type { Goal, Investment } from '@/types'
import { formatPercent } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useConfirm } from '@/hooks/useConfirm'
import { Target, Plus, Edit2, Trash2, TrendingUp, PieChart, GraduationCap } from 'lucide-react'
import { calculateEducationPlan, type EducationPlanParams } from '@/lib/calculations/education'

/**
 * Solve for the annual return rate (CAGR) needed to grow `currentValue` plus
 * ongoing monthly contributions into `targetCorpus` over `years`.
 *
 *   FV = currentValue * (1 + r)^n + monthlyContrib * 12 * ((1 + r)^n - 1) / r
 *
 * Uses bisection because the equation is transcendental in r.
 * Returns null when years <= 0 or the target is unreachable within 0-500%/yr.
 */
function requiredCAGR(
  currentValue: number,
  monthlyContrib: number,
  targetCorpus: number,
  years: number,
): number | null {
  if (years <= 0 || targetCorpus <= 0) return null
  if (currentValue >= targetCorpus) return 0

  const n = years
  const annualContrib = monthlyContrib * 12

  const fv = (r: number) => {
    if (Math.abs(r) < 1e-9) return currentValue + annualContrib * n
    const growth = Math.pow(1 + r, n)
    return currentValue * growth + annualContrib * ((growth - 1) / r)
  }

  // If even at 0% return the contributions alone cover the target, 0% is enough.
  if (fv(0) >= targetCorpus) return 0

  let lo = 0
  let hi = 0.5
  while (fv(hi) < targetCorpus && hi < 5) hi *= 2
  if (fv(hi) < targetCorpus) return null // unreachable

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (fv(mid) > targetCorpus) hi = mid
    else lo = mid
    if (hi - lo < 1e-6) break
  }
  return (lo + hi) / 2
}

export default function GoalsPage() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const sips = useLiveQuery(() => db.sips.toArray(), [])
  const { fmt } = useMasked()
  const { confirm, confirmProps } = useConfirm()

  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [form, setForm] = useState({ name: '', targetCorpus: 0, targetYear: new Date().getFullYear() + 10, color: '#171717' })

  // Education planner (4.3)
  const [showEduPlanner, setShowEduPlanner] = useState(false)
  const [eduForm, setEduForm] = useState<EducationPlanParams>({
    currentAnnualFees: 500000,
    yearsOfStudy: 4,
    childCurrentAge: 5,
    targetAdmissionAge: 18,
    educationInflation: 0.10,
    expectedReturn: 0.12,
    currentCorpus: 0,
  })
  const eduResult = useMemo(() => calculateEducationPlan(eduForm), [eduForm])

  const goalList = goals ?? []
  const inv = investments ?? []
  const sipList = sips ?? []

  const goalStats = useMemo(() => {
    return goalList.map(g => {
      const goalInv = inv.filter(i => i.goal.toLowerCase() === g.name.toLowerCase())
      const currentValue = goalInv.reduce((s, i) => s + i.currentValue, 0)
      const investedValue = goalInv.reduce((s, i) => s + i.investedValue, 0)
      const goalSips = sipList.filter(s => s.goal.toLowerCase() === g.name.toLowerCase() && s.active)
      const monthlySIP = goalSips.reduce((s, sip) => s + sip.amount, 0)

      const target = g.targetCorpus || 0
      const progress = target > 0 ? Math.min(100, (currentValue / target) * 100) : 0
      const remaining = target > 0 ? Math.max(0, target - currentValue) : 0

      // Years remaining to target year (fractional, floored at 0)
      const yearsToTarget = g.targetYear
        ? Math.max(0, g.targetYear - new Date().getFullYear())
        : null

      // Required CAGR to reach target given current value + ongoing SIPs
      const requiredReturn = target > 0 && yearsToTarget !== null && yearsToTarget > 0
        ? requiredCAGR(currentValue, monthlySIP, target, yearsToTarget)
        : null

      // Equity/Debt split
      const equity = goalInv.filter(i => i.assetClass === 'equity').reduce((s, i) => s + i.currentValue, 0)
      const debt = goalInv.filter(i => i.assetClass === 'debt' || i.assetClass === 'fixed').reduce((s, i) => s + i.currentValue, 0)
      const real = goalInv.filter(i => i.assetClass === 'real_estate').reduce((s, i) => s + i.currentValue, 0)

      // P&L % and simple CAGR (2.3)
      const pl = currentValue - investedValue
      const plPercent = investedValue > 0 ? pl / investedValue : 0

      // CAGR = (current/invested)^(1/years) - 1 using earliest startDate
      const earliestDate = goalInv.reduce((min, i) => {
        const d = i.startDate
        return d && d < min ? d : min
      }, new Date().toISOString().split('T')[0])
      const yearsHeld = (Date.now() - new Date(earliestDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      const cagr = investedValue > 0 && yearsHeld >= 0.5 && currentValue > 0
        ? Math.pow(currentValue / investedValue, 1 / yearsHeld) - 1
        : null

      return {
        ...g,
        currentValue,
        investedValue,
        monthlySIP,
        holdingsCount: goalInv.length,
        progress,
        remaining,
        yearsToTarget,
        requiredReturn,
        equity,
        debt,
        real,
        pl,
        plPercent,
        cagr,
      }
    })
  }, [goalList, inv, sipList])

  // Untagged investments
  const untagged = useMemo(() => {
    const goalNames = new Set(goalList.map(g => g.name.toLowerCase()))
    return inv.filter(i => !goalNames.has(i.goal.toLowerCase()))
  }, [goalList, inv])

  const totalAcrossGoals = goalStats.reduce((s, g) => s + g.currentValue, 0)

  function openAdd() {
    setForm({ name: '', targetCorpus: 0, targetYear: new Date().getFullYear() + 10, color: '#171717' })
    setEditingGoal(null)
    setShowForm(true)
  }

  function openEdit(g: Goal) {
    setForm({
      name: g.name,
      targetCorpus: g.targetCorpus || 0,
      targetYear: g.targetYear || new Date().getFullYear() + 10,
      color: g.color || '#171717',
    })
    setEditingGoal(g)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const data = {
      name: form.name.trim(),
      targetCorpus: form.targetCorpus || undefined,
      targetYear: form.targetYear || undefined,
      color: form.color,
    }
    if (editingGoal?.id) {
      // Also update investments if name changed
      if (editingGoal.name !== data.name) {
        const toUpdate = inv.filter(i => i.goal.toLowerCase() === editingGoal.name.toLowerCase())
        for (const i of toUpdate) {
          if (i.id) await db.investments.update(i.id, { goal: data.name })
        }
      }
      await db.goals.update(editingGoal.id, data)
    } else {
      await db.goals.add(data)
    }
    setShowForm(false)
  }

  async function handleDelete(g: Goal) {
    const ok = await confirm({
      title: `Delete "${g.name}" goal?`,
      description: "Investments tagged with this goal won't be deleted, but they'll appear untagged.",
      variant: 'destructive',
      confirmLabel: 'Delete goal',
    })
    if (!ok) return
    if (g.id) await db.goals.delete(g.id)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Track progress towards your financial goals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowEduPlanner(true)}>
            <GraduationCap className="h-4 w-4 mr-1" /> Education Planner
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Goal
          </Button>
        </div>
      </div>

      {/* Goal Cards */}
      {goalStats.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-10 w-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">No goals set up yet. Add your first goal to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {goalStats.map(g => (
            <Card key={g.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color || '#171717' }} />
                    <h3 className="font-semibold text-lg">{g.name}</h3>
                    <Badge variant="default" className="text-[10px]">
                      {g.holdingsCount} holding{g.holdingsCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(g)} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      <Edit2 className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
                    </button>
                    <button onClick={() => handleDelete(g)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950">
                      <Trash2 className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-red-500" />
                    </button>
                  </div>
                </div>

                {g.targetCorpus ? (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {fmt(g.currentValue)} of {fmt(g.targetCorpus)}
                        {g.targetYear ? ` by ${g.targetYear}` : ''}
                      </span>
                      <span className="font-medium">{g.progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={g.progress} className="h-2" />
                    <div className="flex justify-between items-center text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      <span>
                        {g.remaining > 0 ? `${fmt(g.remaining)} remaining` : 'Target reached'}
                        {g.yearsToTarget !== null && g.remaining > 0 && ` · ${g.yearsToTarget}y left`}
                      </span>
                      {g.requiredReturn !== null && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          <span className="font-medium">
                            {g.requiredReturn === 0
                              ? 'On track at 0% return'
                              : `${(g.requiredReturn * 100).toFixed(1)}% CAGR needed`}
                          </span>
                        </span>
                      )}
                      {g.requiredReturn === null && g.yearsToTarget !== null && g.yearsToTarget > 0 && g.remaining > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Unreachable at current SIP
                        </span>
                      )}
                      {g.yearsToTarget === 0 && g.remaining > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-medium">Target year passed</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-3">No target set — <button onClick={() => openEdit(g)} className="underline hover:text-neutral-600 dark:hover:text-neutral-300">add one</button></p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs">Current Value</p>
                    <p className="font-semibold">{fmt(g.currentValue)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs">Invested</p>
                    <p className="font-medium">{fmt(g.investedValue)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs">P&L</p>
                    <p className={`font-medium ${g.pl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {g.pl >= 0 ? '+' : ''}{fmt(g.pl)} ({g.pl >= 0 ? '+' : ''}{formatPercent(g.plPercent)})
                    </p>
                    {g.cagr !== null && (
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        CAGR: {formatPercent(g.cagr)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs">Monthly SIP</p>
                    <p className="font-medium">{fmt(g.monthlySIP)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs">Allocation</p>
                    <div className="flex gap-1 mt-0.5">
                      {g.equity > 0 && <Badge variant="success" className="text-[9px] px-1">E: {((g.equity / g.currentValue) * 100).toFixed(0)}%</Badge>}
                      {g.debt > 0 && <Badge variant="default" className="text-[9px] px-1">D: {((g.debt / g.currentValue) * 100).toFixed(0)}%</Badge>}
                      {g.real > 0 && <Badge variant="danger" className="text-[9px] px-1">R: {((g.real / g.currentValue) * 100).toFixed(0)}%</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Untagged investments */}
      {untagged.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-600">Untagged Investments</CardTitle>
            <CardDescription>{untagged.length} investment{untagged.length !== 1 ? 's' : ''} not assigned to any goal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {untagged.map(i => (
                <div key={i.id} className="flex items-center justify-between text-sm border-b border-neutral-50 dark:border-neutral-800 pb-2">
                  <div>
                    <span className="font-medium">{i.instrument}</span>
                    <span className="text-neutral-400 dark:text-neutral-500 ml-2 text-xs">({i.goal})</span>
                  </div>
                  <span>{fmt(i.currentValue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {goalStats.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
              <h3 className="font-medium text-sm">Goal Allocation</h3>
            </div>
            <div className="space-y-2">
              {goalStats.filter(g => g.currentValue > 0).map(g => (
                <div key={g.id} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color || '#171717' }} />
                  <span className="text-sm flex-1">{g.name}</span>
                  <span className="text-sm font-medium">{fmt(g.currentValue)}</span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 w-12 text-right">
                    {totalAcrossGoals > 0 ? ((g.currentValue / totalAcrossGoals) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editingGoal ? 'Edit Goal' : 'Add Goal'}>
        <div className="space-y-4">
          <div>
            <Label>Goal Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Retirement, House, Education"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target Corpus</Label>
              <Input
                type="number"
                value={form.targetCorpus || ''}
                onChange={e => setForm({ ...form, targetCorpus: Number(e.target.value) })}
                placeholder="e.g. 10000000"
              />
            </div>
            <div>
              <Label>Target Year</Label>
              <Input
                type="number"
                value={form.targetYear || ''}
                onChange={e => setForm({ ...form, targetYear: Number(e.target.value) })}
                placeholder="e.g. 2040"
              />
            </div>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                className="h-8 w-12 rounded border cursor-pointer"
              />
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{form.color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editingGoal ? 'Save Changes' : 'Add Goal'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Education Planner Dialog (4.3) */}
      <Dialog open={showEduPlanner} onClose={() => setShowEduPlanner(false)} title="Education Cost Planner">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Current Annual Fees</Label>
              <Input type="number" value={eduForm.currentAnnualFees || ''} onChange={e => setEduForm(f => ({ ...f, currentAnnualFees: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Years of Study</Label>
              <Input type="number" value={eduForm.yearsOfStudy} onChange={e => setEduForm(f => ({ ...f, yearsOfStudy: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Child's Current Age</Label>
              <Input type="number" value={eduForm.childCurrentAge} onChange={e => setEduForm(f => ({ ...f, childCurrentAge: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Target Admission Age</Label>
              <Input type="number" value={eduForm.targetAdmissionAge} onChange={e => setEduForm(f => ({ ...f, targetAdmissionAge: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Education Inflation (%)</Label>
              <Input type="number" step="1" value={Math.round(eduForm.educationInflation * 100)} onChange={e => setEduForm(f => ({ ...f, educationInflation: Number(e.target.value) / 100 }))} />
            </div>
            <div>
              <Label>Expected SIP Return (%)</Label>
              <Input type="number" step="1" value={Math.round(eduForm.expectedReturn * 100)} onChange={e => setEduForm(f => ({ ...f, expectedReturn: Number(e.target.value) / 100 }))} />
            </div>
            <div className="col-span-2">
              <Label>Already Saved for This Goal</Label>
              <Input type="number" value={eduForm.currentCorpus || ''} onChange={e => setEduForm(f => ({ ...f, currentCorpus: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Years to go</span>
              <span className="font-medium">{eduResult.yearsToGo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Future annual cost (at admission)</span>
              <span className="font-medium">{fmt(eduResult.futureAnnualCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Total future cost ({eduForm.yearsOfStudy}y study)</span>
              <span className="font-bold">{fmt(eduResult.futureTotalCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Gap after existing savings</span>
              <span className="font-medium text-amber-600">{fmt(eduResult.gap)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-neutral-200 dark:border-neutral-700 pt-2 mt-2">
              <span className="text-neutral-500 dark:text-neutral-400">Required monthly SIP</span>
              <span className="font-bold text-lg text-emerald-600">{fmt(eduResult.requiredMonthlySIP)}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowEduPlanner(false)}>Close</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}
