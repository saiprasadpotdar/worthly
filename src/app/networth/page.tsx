'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useMasked } from '@/hooks/useMasked'
import { db, seedDefaultGoals } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import type { Investment } from '@/types'
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
import { Plus, Trash2, TrendingUp, Edit2, ArrowUpDown, Upload, FileText } from 'lucide-react'
import { parseCAMSPdf, type CamsParseResult } from '@/lib/import/cams'
import { parseKuveraCSV, type KuveraParseResult } from '@/lib/import/kuvera'

type SortKey = 'instrument' | 'invested' | 'current' | 'pl' | 'weight'
type SortDir = 'asc' | 'desc'

export default function NetWorthPage() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const investments = useLiveQuery(() => db.investments.toArray(), [])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [form, setForm] = useState<Omit<Investment, 'id'>>({
    goal: '',
    assetClass: 'equity',
    instrument: '',
    investedValue: 0,
    currentValue: 0,
    startDate: new Date().toISOString().split('T')[0],
    platform: '',
  })

  // Filters
  const [filterGoal, setFilterGoal] = useState('all')
  const [filterClass, setFilterClass] = useState('all')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('current')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // CAMS import
  const [showCamsDialog, setShowCamsDialog] = useState(false)
  const [camsPassword, setCamsPassword] = useState('')
  const [camsFile, setCamsFile] = useState<File | null>(null)
  const [camsLoading, setCamsLoading] = useState(false)
  const [camsError, setCamsError] = useState('')
  const [camsPreview, setCamsPreview] = useState<Omit<Investment, 'id'>[]>([])
  const [camsDebug, setCamsDebug] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)

  // Kuvera import
  const [showKuveraDialog, setShowKuveraDialog] = useState(false)
  const [kuveraFile, setKuveraFile] = useState<File | null>(null)
  const [kuveraLoading, setKuveraLoading] = useState(false)
  const [kuveraError, setKuveraError] = useState('')
  const [kuveraPreview, setKuveraPreview] = useState<Omit<Investment, 'id'>[]>([])

  const { confirm, confirmProps } = useConfirm()
  const { fmt } = useMasked()

  useEffect(() => { seedDefaultGoals() }, [])

  const goalList = goals ?? []
  const inv = investments ?? []

  const totalInvested = inv.reduce((s, i) => s + i.investedValue, 0)
  const totalCurrent = inv.reduce((s, i) => s + i.currentValue, 0)
  const totalPL = totalCurrent - totalInvested

  const defaultGoal = goalList[0]?.name ?? ''

  // Filtered & sorted list
  const filteredSorted = useMemo(() => {
    let items = [...inv]
    if (filterGoal !== 'all') {
      items = items.filter(i => i.goal.toLowerCase() === filterGoal.toLowerCase())
    }
    if (filterClass !== 'all') {
      items = items.filter(i => i.assetClass === filterClass)
    }

    const totalCV = inv.reduce((s, i) => s + i.currentValue, 0)
    items.sort((a, b) => {
      let va = 0, vb = 0
      switch (sortKey) {
        case 'instrument': return sortDir === 'asc'
          ? a.instrument.localeCompare(b.instrument)
          : b.instrument.localeCompare(a.instrument)
        case 'invested': va = a.investedValue; vb = b.investedValue; break
        case 'current': va = a.currentValue; vb = b.currentValue; break
        case 'pl': va = a.currentValue - a.investedValue; vb = b.currentValue - b.investedValue; break
        case 'weight':
          va = totalCV > 0 ? a.currentValue / totalCV : 0
          vb = totalCV > 0 ? b.currentValue / totalCV : 0
          break
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return items
  }, [inv, filterGoal, filterClass, sortKey, sortDir])

  // Filtered totals
  const filteredInvested = filteredSorted.reduce((s, i) => s + i.investedValue, 0)
  const filteredCurrent = filteredSorted.reduce((s, i) => s + i.currentValue, 0)
  const filteredPL = filteredCurrent - filteredInvested

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
    return <span className="ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function openAdd() {
    setForm({
      goal: defaultGoal,
      assetClass: 'equity',
      instrument: '',
      investedValue: 0,
      currentValue: 0,
      startDate: new Date().toISOString().split('T')[0],
      platform: '',
    })
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(item: Investment) {
    setForm({
      goal: item.goal,
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
    const ok = await confirm({
      title: 'Delete investment?',
      description: 'This investment entry will be permanently removed.',
      variant: 'destructive',
      confirmLabel: 'Delete',
    })
    if (ok) await db.investments.delete(id)
  }

  // CAMS import handlers
  async function handleCamsParse() {
    if (!camsFile) return
    setCamsLoading(true)
    setCamsError('')
    setCamsPreview([])
    setCamsDebug([])
    setShowDebug(false)
    try {
      const arrayBuf = await camsFile.arrayBuffer()
      const result = await parseCAMSPdf(arrayBuf, camsPassword)
      setCamsDebug(result.debugInfo)
      if (result.holdings.length === 0) {
        setCamsError('No mutual fund holdings found. Tap "Show Debug Log" to see what was extracted from the PDF.')
      } else {
        setCamsPreview(result.holdings)
      }
    } catch (err: any) {
      setCamsError(err?.message || 'Failed to parse PDF. Check password and file format.')
    } finally {
      setCamsLoading(false)
    }
  }

  async function handleCamsImport() {
    if (camsPreview.length === 0) return
    await db.investments.bulkAdd(camsPreview.map(i => ({ ...i })))
    setCamsPreview([])
    setCamsFile(null)
    setCamsPassword('')
    setShowCamsDialog(false)
  }

  // Kuvera import handlers
  async function handleKuveraParse() {
    if (!kuveraFile) return
    setKuveraLoading(true)
    setKuveraError('')
    setKuveraPreview([])
    try {
      const text = await kuveraFile.text()
      const result = parseKuveraCSV(text)
      if (result.errors.length > 0 && result.holdings.length === 0) {
        setKuveraError(result.errors.join('\n'))
      } else {
        setKuveraPreview(result.holdings)
        if (result.errors.length > 0) {
          setKuveraError(`Parsed ${result.holdings.length} holdings with ${result.errors.length} warnings.`)
        }
      }
    } catch (err: any) {
      setKuveraError(err?.message || 'Failed to parse CSV.')
    } finally {
      setKuveraLoading(false)
    }
  }

  async function handleKuveraImport() {
    if (kuveraPreview.length === 0) return
    await db.investments.bulkAdd(kuveraPreview.map(i => ({ ...i })))
    setKuveraPreview([])
    setKuveraFile(null)
    setShowKuveraDialog(false)
  }

  // Goal color helper
  function goalBadgeVariant(goal: string): 'default' | 'success' | 'warning' | 'danger' {
    const g = goal.toLowerCase()
    if (g === 'retirement') return 'success'
    if (g === 'emergency') return 'warning'
    return 'default'
  }

  function classBadgeVariant(cls: string): 'default' | 'success' | 'warning' | 'danger' {
    if (cls === 'equity') return 'success'
    if (cls === 'debt') return 'default'
    if (cls === 'real_estate') return 'danger'
    return 'warning'
  }

  const isFiltered = filterGoal !== 'all' || filterClass !== 'all'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Net Worth</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Track your investments and assets</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowKuveraDialog(true)}>
            <Upload className="h-4 w-4 mr-1" /> Kuvera CSV
          </Button>
          <Button variant="outline" onClick={() => setShowCamsDialog(true)}>
            <FileText className="h-4 w-4 mr-1" /> Import CAS
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Investment</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Total Invested</p>
            <p className="text-xl font-bold">{fmt(totalInvested, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Current Value</p>
            <p className="text-xl font-bold">{fmt(totalCurrent, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Total P&L</p>
            <p className={`text-xl font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalPL >= 0 ? '+' : ''}{fmt(totalPL, true)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Goal</Label>
              <Select
                value={filterGoal}
                onChange={e => setFilterGoal(e.target.value)}
                className="h-8 text-xs w-32"
              >
                <option value="all">All goals</option>
                {goalList.map(g => (
                  <option key={g.id} value={g.name.toLowerCase()}>{g.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Class</Label>
              <Select
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
                className="h-8 text-xs w-32"
              >
                <option value="all">All classes</option>
                <option value="equity">Equity</option>
                <option value="debt">Debt</option>
                <option value="fixed">Fixed Income</option>
                <option value="real_estate">Real Estate</option>
              </Select>
            </div>
            {isFiltered && (
              <button
                onClick={() => { setFilterGoal('all'); setFilterClass('all') }}
                className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 underline"
              >
                Clear filters
              </button>
            )}
            <div className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">
              {filteredSorted.length} of {inv.length} investments
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investment Table */}
      <Card>
        <CardContent className="p-0">
          {filteredSorted.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />}
              title={isFiltered ? 'No matching investments' : 'No investments yet'}
              description={isFiltered ? 'Try changing the filters above.' : 'Add your first investment to start tracking.'}
              actionLabel={isFiltered ? undefined : 'Add Investment'}
              onAction={isFiltered ? undefined : openAdd}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">
                      <button onClick={() => toggleSort('instrument')} className="flex items-center hover:text-neutral-700 dark:hover:text-neutral-300">
                        Instrument <SortIcon col="instrument" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Goal</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">Class</th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">
                      <button onClick={() => toggleSort('invested')} className="flex items-center justify-end hover:text-neutral-700 dark:hover:text-neutral-300 ml-auto">
                        Invested <SortIcon col="invested" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">
                      <button onClick={() => toggleSort('current')} className="flex items-center justify-end hover:text-neutral-700 dark:hover:text-neutral-300 ml-auto">
                        Current <SortIcon col="current" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">
                      <button onClick={() => toggleSort('pl')} className="flex items-center justify-end hover:text-neutral-700 dark:hover:text-neutral-300 ml-auto">
                        P&L <SortIcon col="pl" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500 dark:text-neutral-400">
                      <button onClick={() => toggleSort('weight')} className="flex items-center justify-end hover:text-neutral-700 dark:hover:text-neutral-300 ml-auto">
                        Weight <SortIcon col="weight" />
                      </button>
                    </th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map(item => {
                    const pl = item.currentValue - item.investedValue
                    const weight = totalCurrent > 0 ? item.currentValue / totalCurrent : 0
                    return (
                      <tr key={item.id} className="border-b border-neutral-50 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{item.instrument}</div>
                          {item.platform && <div className="text-xs text-neutral-400 dark:text-neutral-500">{item.platform}</div>}
                        </td>
                        <td className="py-2.5 px-2">
                          <Badge variant={goalBadgeVariant(item.goal)}>{item.goal}</Badge>
                        </td>
                        <td className="py-2.5 px-2">
                          <Badge variant={classBadgeVariant(item.assetClass)}>{item.assetClass}</Badge>
                        </td>
                        <td className="py-2.5 px-2 text-right">{fmt(item.investedValue)}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{fmt(item.currentValue)}</td>
                        <td className={`py-2.5 px-2 text-right ${pl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {pl >= 0 ? '+' : ''}{fmt(pl)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-neutral-500 dark:text-neutral-400">{(weight * 100).toFixed(1)}%</td>
                        <td className="py-2.5 px-2 text-right">
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
                <tfoot>
                  <tr className="font-medium bg-neutral-50/50 dark:bg-neutral-800/50">
                    <td className="py-3 px-4" colSpan={3}>
                      {isFiltered ? 'Filtered Total' : 'Total'}
                    </td>
                    <td className="py-3 px-2 text-right">{fmt(filteredInvested)}</td>
                    <td className="py-3 px-2 text-right">{fmt(filteredCurrent)}</td>
                    <td className={`py-3 px-2 text-right ${filteredPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {filteredPL >= 0 ? '+' : ''}{fmt(filteredPL)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {totalCurrent > 0 ? ((filteredCurrent / totalCurrent) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Investment' : 'Add Investment'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Goal</Label>
              <Select value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })}>
                {goalList.map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Asset Class</Label>
              <Select value={form.assetClass} onChange={e => setForm({ ...form, assetClass: e.target.value as any })}>
                <option value="equity">Equity</option>
                <option value="debt">Debt</option>
                <option value="fixed">Fixed Income</option>
                <option value="real_estate">Real Estate</option>
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

      {/* CAMS Import Dialog */}
      <Dialog open={showCamsDialog} onClose={() => { setShowCamsDialog(false); setCamsPreview([]); setCamsError(''); setCamsDebug([]); setShowDebug(false) }} title="Import CAMS / KFintech CAS">
        <div className="space-y-4">
          {camsPreview.length === 0 ? (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Upload your Consolidated Account Statement (CAS) PDF from CAMS or KFintech. The PDF is usually password-protected with your PAN (e.g., ABCDE1234F).
              </p>
              <div>
                <Label>CAS PDF File</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={e => setCamsFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
              <div>
                <Label>PDF Password</Label>
                <Input
                  type="password"
                  value={camsPassword}
                  onChange={e => setCamsPassword(e.target.value)}
                  placeholder="Usually your PAN number"
                />
              </div>
              {camsError && (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">{camsError}</p>
                  {camsDebug.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="text-xs text-neutral-500 dark:text-neutral-400 underline hover:text-neutral-700 dark:hover:text-neutral-300"
                      >
                        {showDebug ? 'Hide Debug Log' : 'Show Debug Log'}
                      </button>
                      {showDebug && (
                        <pre className="text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-neutral-600">
                          {camsDebug.join('\n')}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCamsDialog(false)}>Cancel</Button>
                <Button onClick={handleCamsParse} disabled={!camsFile || camsLoading}>
                  {camsLoading ? 'Parsing...' : 'Parse PDF'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Found <strong>{camsPreview.length}</strong> mutual fund holdings. Review and import:
              </p>
              <div className="max-h-64 overflow-y-auto border border-neutral-100 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Fund</th>
                      <th className="text-right p-2 font-medium">Invested</th>
                      <th className="text-right p-2 font-medium">Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {camsPreview.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-50 dark:border-neutral-800">
                        <td className="p-2">
                          <div className="font-medium">{item.instrument}</div>
                          <div className="text-neutral-400 dark:text-neutral-500">{item.platform}</div>
                        </td>
                        <td className="p-2 text-right">{formatCurrency(item.investedValue)}</td>
                        <td className="p-2 text-right">{formatCurrency(item.currentValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-neutral-400 dark:text-neutral-500">
                All funds will be imported as Equity under the "{defaultGoal}" goal. You can change goal/class after import.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCamsPreview([])}>Back</Button>
                <Button onClick={handleCamsImport}>Import {camsPreview.length} Holdings</Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Kuvera CSV Import Dialog */}
      <Dialog open={showKuveraDialog} onClose={() => { setShowKuveraDialog(false); setKuveraPreview([]); setKuveraError('') }} title="Import from Kuvera CSV">
        <div className="space-y-4">
          {kuveraPreview.length === 0 ? (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Upload your portfolio CSV exported from Kuvera. Go to Kuvera → Portfolio → Download → CSV.
              </p>
              <div>
                <Label>CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={e => setKuveraFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
              {kuveraError && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">{kuveraError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowKuveraDialog(false)}>Cancel</Button>
                <Button onClick={handleKuveraParse} disabled={!kuveraFile || kuveraLoading}>
                  {kuveraLoading ? 'Parsing...' : 'Parse CSV'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Found <strong>{kuveraPreview.length}</strong> holdings. Review and import:
              </p>
              <div className="max-h-64 overflow-y-auto border border-neutral-100 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Fund</th>
                      <th className="text-right p-2 font-medium">Invested</th>
                      <th className="text-right p-2 font-medium">Current</th>
                      <th className="text-center p-2 font-medium">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kuveraPreview.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-50 dark:border-neutral-800">
                        <td className="p-2">
                          <div className="font-medium">{item.instrument}</div>
                        </td>
                        <td className="p-2 text-right">{formatCurrency(item.investedValue)}</td>
                        <td className="p-2 text-right">{formatCurrency(item.currentValue)}</td>
                        <td className="p-2 text-center">
                          <Badge variant={classBadgeVariant(item.assetClass)} className="text-[10px]">
                            {item.assetClass}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setKuveraPreview([])}>Back</Button>
                <Button onClick={handleKuveraImport}>Import {kuveraPreview.length} Holdings</Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}
