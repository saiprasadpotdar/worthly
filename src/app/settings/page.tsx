'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import type { UserProfile } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { exportToJSON, importFromJSON, exportToXLSX, downloadJSON, downloadBlob } from '@/lib/export'
import { Download, Upload, FileJson, FileSpreadsheet, Save, Trash2, AlertTriangle } from 'lucide-react'

const defaultProfile: Omit<UserProfile, 'id'> = {
  name: '',
  startDate: new Date().toISOString().split('T')[0],
  birthYear: 1996,
  monthlyExpenses: 60000,
  monthlyEmi: 0,
  desiredEquityRatio: 0.7,
  desiredDebtRatio: 0.3,
  desiredLiquidToNW: 0.6,
  desiredRealToNW: 0.4,
  desiredSavingsToIncome: 0.65,
  desiredLoanToAsset: 0.2,
}

export default function SettingsPage() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first(), [])
  const [form, setForm] = useState(defaultProfile)
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        startDate: profile.startDate,
        birthYear: profile.birthYear,
        monthlyExpenses: profile.monthlyExpenses,
        monthlyEmi: profile.monthlyEmi,
        desiredEquityRatio: profile.desiredEquityRatio,
        desiredDebtRatio: profile.desiredDebtRatio,
        desiredLiquidToNW: profile.desiredLiquidToNW,
        desiredRealToNW: profile.desiredRealToNW,
        desiredSavingsToIncome: profile.desiredSavingsToIncome,
        desiredLoanToAsset: profile.desiredLoanToAsset,
      })
    }
  }, [profile])

  async function handleSave() {
    if (profile?.id) {
      await db.userProfile.update(profile.id, form)
    } else {
      await db.userProfile.add(form)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleExportJSON() {
    const json = await exportToJSON()
    downloadJSON(json, `worthly-backup-${new Date().toISOString().split('T')[0]}.json`)
  }

  async function handleExportXLSX() {
    const blob = await exportToXLSX()
    downloadBlob(blob, `worthly-export-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      await importFromJSON(text)
      window.location.reload()
    } catch (err) {
      alert('Failed to import. Please check the file format.')
    } finally {
      setImporting(false)
    }
  }

  async function handleClearData() {
    if (!confirm('Are you sure you want to delete ALL data? This cannot be undone.')) return
    if (!confirm('Really? This will permanently delete everything.')) return
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
    window.location.reload()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-neutral-500 text-sm mt-1">Configure your profile and manage data</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your basic financial profile used for calculations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
            <div><Label>FI Journey Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Birth Year</Label><Input type="number" value={form.birthYear} onChange={e => setForm({ ...form, birthYear: Number(e.target.value) })} /></div>
            <div><Label>Monthly Expenses</Label><Input type="number" value={form.monthlyExpenses || ''} onChange={e => setForm({ ...form, monthlyExpenses: Number(e.target.value) })} /></div>
            <div><Label>Monthly EMI</Label><Input type="number" value={form.monthlyEmi || ''} onChange={e => setForm({ ...form, monthlyEmi: Number(e.target.value) })} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Desired Ratios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Ratios</CardTitle>
          <CardDescription>Set your desired financial ratios for tracking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Equity Allocation</Label><Input type="number" step="0.05" min="0" max="1" value={form.desiredEquityRatio} onChange={e => setForm({ ...form, desiredEquityRatio: Number(e.target.value) })} /></div>
            <div><Label>Debt Allocation</Label><Input type="number" step="0.05" min="0" max="1" value={form.desiredDebtRatio} onChange={e => setForm({ ...form, desiredDebtRatio: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Liquid Assets / Net Worth</Label><Input type="number" step="0.05" min="0" max="1" value={form.desiredLiquidToNW} onChange={e => setForm({ ...form, desiredLiquidToNW: Number(e.target.value) })} /></div>
            <div><Label>Real Assets / Net Worth</Label><Input type="number" step="0.05" min="0" max="1" value={form.desiredRealToNW} onChange={e => setForm({ ...form, desiredRealToNW: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Savings / Income</Label><Input type="number" step="0.05" min="0" max="1" value={form.desiredSavingsToIncome} onChange={e => setForm({ ...form, desiredSavingsToIncome: Number(e.target.value) })} /></div>
            <div><Label>Loan / Assets</Label><Input type="number" step="0.05" min="0" max="1" value={form.desiredLoanToAsset} onChange={e => setForm({ ...form, desiredLoanToAsset: Number(e.target.value) })} /></div>
          </div>
          <p className="text-xs text-neutral-400">Values should be between 0 and 1 (e.g., 0.7 = 70%)</p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saved ? 'Saved!' : 'Save Profile'}
      </Button>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
          <CardDescription>Export, import, or clear your financial data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" onClick={handleExportJSON} className="justify-start">
              <FileJson className="h-4 w-4 mr-2" /> Export as JSON
            </Button>
            <Button variant="outline" onClick={handleExportXLSX} className="justify-start">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Export as XLSX
            </Button>
          </div>

          <div className="relative">
            <Button variant="outline" className="w-full justify-start" disabled={importing}>
              <Upload className="h-4 w-4 mr-2" /> {importing ? 'Importing...' : 'Import from JSON'}
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          <div className="border-t border-neutral-100 pt-3 mt-3">
            <Button variant="destructive" onClick={handleClearData} className="w-full justify-start">
              <Trash2 className="h-4 w-4 mr-2" /> Clear All Data
            </Button>
            <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> This will permanently delete all your data from this browser
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-50 p-2 mt-0.5">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <p className="text-sm font-medium">Your data stays private</p>
              <p className="text-xs text-neutral-500 mt-0.5">All data is stored locally in your browser using IndexedDB. Nothing is sent to any server. Export regularly to keep backups.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
