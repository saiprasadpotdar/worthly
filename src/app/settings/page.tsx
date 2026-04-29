'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { db, seedDefaultGoals } from '@/lib/db'
import type { UserProfile } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { exportToJSON, importFromJSON, exportToXLSX, downloadJSON, downloadBlob } from '@/lib/export'
import { Download, Upload, FileJson, FileSpreadsheet, Save, Trash2, AlertTriangle, Plus, X, Lock, LockOpen, Eye, EyeOff, Cloud, CloudOff } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useConfirm } from '@/hooks/useConfirm'
import { hashPasskey } from '@/context/app-context'
import {
  authorize as driveAuth,
  uploadBackup,
  downloadBackup,
  clearDriveToken,
  getDriveClientId,
  setDriveClientId,
  getLastBackupTime,
  isConnected as isDriveConnected,
} from '@/lib/sync/drive'

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
  fiMultiplier: 25,
  retirementAge: 50,
}

export default function SettingsPage() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [form, setForm] = useState(defaultProfile)
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newGoalName, setNewGoalName] = useState('')
  const [importError, setImportError] = useState(false)
  const { confirm, confirmProps } = useConfirm()
  const [passkeyInput, setPasskeyInput] = useState('')
  const [passkeyConfirm, setPasskeyConfirm] = useState('')
  const [passkeyError, setPasskeyError] = useState('')
  const [passkeySaved, setPasskeySaved] = useState(false)
  const [showPasskeyInput, setShowPasskeyInput] = useState(false)
  const hasPasskey = !!(profile as any)?.passkey

  // Google Drive state
  const [driveClientId, setDriveClientIdLocal] = useState(() => getDriveClientId())
  const [driveConnected, setDriveConnected] = useState(() => isDriveConnected())
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveStatus, setDriveStatus] = useState('')
  const [lastBackup, setLastBackup] = useState(() => getLastBackupTime())

  useEffect(() => { seedDefaultGoals() }, [])

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
        fiMultiplier: profile.fiMultiplier ?? 25,
        retirementAge: profile.retirementAge ?? 50,
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
    setImportError(false)
    try {
      const text = await file.text()
      await importFromJSON(text)
      window.location.reload()
    } catch (err) {
      setImportError(true)
      setTimeout(() => setImportError(false), 4000)
    } finally {
      setImporting(false)
    }
  }

  async function handleClearData() {
    const first = await confirm({
      title: 'Delete all data?',
      description: 'Are you sure you want to delete ALL data? This cannot be undone.',
      variant: 'destructive',
      confirmLabel: 'Yes, delete everything',
    })
    if (!first) return
    const second = await confirm({
      title: 'Final confirmation',
      description: 'This will permanently delete all your financial data from this browser. There is no undo.',
      variant: 'destructive',
      confirmLabel: 'Delete permanently',
    })
    if (!second) return
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
    window.location.reload()
  }

  async function handleSetPasskey() {
    setPasskeyError('')
    if (passkeyInput.length < 4) {
      setPasskeyError('Passkey must be at least 4 characters.')
      return
    }
    if (passkeyInput !== passkeyConfirm) {
      setPasskeyError('Passkeys do not match.')
      return
    }
    const hash = await hashPasskey(passkeyInput)
    if (profile?.id) {
      await db.userProfile.update(profile.id, { passkey: hash } as any)
    }
    setPasskeyInput('')
    setPasskeyConfirm('')
    setPasskeySaved(true)
    setTimeout(() => setPasskeySaved(false), 2000)
    // Update session so user doesn't get locked out immediately
    sessionStorage.setItem('worthly-unlocked', 'true')
  }

  async function handleRemovePasskey() {
    const ok = await confirm({
      title: 'Remove passkey?',
      description: 'Anyone with access to this browser will be able to view your financial data.',
      variant: 'destructive',
      confirmLabel: 'Remove passkey',
    })
    if (!ok) return
    if (profile?.id) {
      await db.userProfile.update(profile.id, { passkey: undefined } as any)
    }
    sessionStorage.removeItem('worthly-unlocked')
  }

  // ─── Google Drive handlers ───────────────────────────

  async function handleDriveConnect() {
    if (!driveClientId.trim()) {
      setDriveStatus('Please enter a Google Client ID first.')
      return
    }
    setDriveClientId(driveClientId.trim())
    setDriveClientIdLocal(driveClientId.trim())
    setDriveLoading(true)
    setDriveStatus('Connecting...')
    try {
      await driveAuth()
      setDriveConnected(true)
      setDriveStatus('Connected to Google Drive!')
      setTimeout(() => setDriveStatus(''), 3000)
    } catch (err: any) {
      setDriveStatus(`Failed: ${err.message}`)
    } finally {
      setDriveLoading(false)
    }
  }

  function handleDriveDisconnect() {
    clearDriveToken()
    setDriveConnected(false)
    setDriveStatus('Disconnected.')
    setLastBackup(null)
    setTimeout(() => setDriveStatus(''), 2000)
  }

  async function handleDriveBackup() {
    setDriveLoading(true)
    setDriveStatus('Backing up...')
    try {
      const json = await exportToJSON()
      await uploadBackup(json)
      setLastBackup(getLastBackupTime())
      setDriveStatus('Backup complete!')
      setTimeout(() => setDriveStatus(''), 3000)
    } catch (err: any) {
      setDriveStatus(`Backup failed: ${err.message}`)
    } finally {
      setDriveLoading(false)
    }
  }

  async function handleDriveRestore() {
    const ok = await confirm({
      title: 'Restore from Google Drive?',
      description: 'This will replace ALL your local data with the backup from Drive. This cannot be undone.',
      variant: 'destructive',
      confirmLabel: 'Restore backup',
    })
    if (!ok) return
    setDriveLoading(true)
    setDriveStatus('Restoring...')
    try {
      const json = await downloadBackup()
      await importFromJSON(json)
      setDriveStatus('Restored! Reloading...')
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      setDriveStatus(`Restore failed: ${err.message}`)
    } finally {
      setDriveLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Configure your profile and manage data</p>
      </div>

      {/* Privacy Info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-50 dark:bg-emerald-950 p-2 mt-0.5">
              <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <p className="text-sm font-medium">Your data stays private</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">All data is stored locally in your browser using IndexedDB. Nothing is sent to any server. Export regularly to keep backups.</p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investment Goals</CardTitle>
          <CardDescription>Organize your investments by goals (e.g., Retirement, Emergency, House, Education)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(goals ?? []).map(g => (
              <div key={g.id} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-sm">
                <span>{g.name}</span>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Remove "${g.name}" goal?`,
                      description: "Investments tagged with this goal won't be deleted, but they'll appear untagged.",
                      variant: 'destructive',
                      confirmLabel: 'Remove',
                    })
                    if (ok) await db.goals.delete(g.id!)
                  }}
                  className="rounded p-0.5 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <X className="h-3 w-3 text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newGoalName}
              onChange={e => setNewGoalName(e.target.value)}
              placeholder="New goal name..."
              className="max-w-xs"
              onKeyDown={async e => {
                if (e.key === 'Enter' && newGoalName.trim()) {
                  await db.goals.add({ name: newGoalName.trim() })
                  setNewGoalName('')
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (newGoalName.trim()) {
                  await db.goals.add({ name: newGoalName.trim() })
                  setNewGoalName('')
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FI Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">FI Targets</CardTitle>
          <CardDescription>How "enough" is computed across the app (Dashboard, Projections, Coast FI)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>FI Multiplier (× annual expenses)</Label>
              <Input
                type="number"
                step="1"
                min="10"
                max="50"
                value={form.fiMultiplier ?? 25}
                onChange={e => setForm({ ...form, fiMultiplier: Number(e.target.value) })}
              />
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                {form.fiMultiplier ?? 25}x ≈ {(100 / (form.fiMultiplier || 25)).toFixed(2)}% SWR · Lean = {((form.fiMultiplier || 25) * 0.5)}x · Fat = {((form.fiMultiplier || 25) * 2)}x
              </p>
            </div>
            <div>
              <Label>Target Retirement Age</Label>
              <Input
                type="number"
                step="1"
                min="30"
                max="80"
                value={form.retirementAge ?? 50}
                onChange={e => setForm({ ...form, retirementAge: Number(e.target.value) })}
              />
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Used for Coast FI calculation</p>
            </div>
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
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Values should be between 0 and 1 (e.g., 0.7 = 70%)</p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saved ? 'Saved!' : 'Save Profile'}
      </Button>

      {/* Passkey / App Lock */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {hasPasskey ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            App Lock
          </CardTitle>
          <CardDescription>
            {hasPasskey
              ? 'A passkey is set. You\'ll be asked to enter it when opening Worthly.'
              : 'Set a passkey to protect your data when opening Worthly in this browser.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasPasskey ? (
            <div className="flex items-center gap-3">
              <Badge variant="success">Passkey active</Badge>
              <Button variant="outline" size="sm" onClick={handleRemovePasskey}>Remove passkey</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>New Passkey</Label>
                  <Input
                    type="password"
                    value={passkeyInput}
                    onChange={e => { setPasskeyInput(e.target.value); setPasskeyError('') }}
                    placeholder="Min 4 characters"
                  />
                </div>
                <div>
                  <Label>Confirm Passkey</Label>
                  <Input
                    type="password"
                    value={passkeyConfirm}
                    onChange={e => { setPasskeyConfirm(e.target.value); setPasskeyError('') }}
                    placeholder="Repeat passkey"
                  />
                </div>
              </div>
              {passkeyError && (
                <p className="text-sm text-red-600">{passkeyError}</p>
              )}
              {passkeySaved && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Passkey set successfully!</p>
              )}
              <Button size="sm" onClick={handleSetPasskey} disabled={!passkeyInput}>
                <Lock className="h-3.5 w-3.5 mr-1" /> Set Passkey
              </Button>
            </>
          )}
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            The passkey is hashed and stored locally. If you forget it, you'll need to clear browser data for this site.
          </p>
        </CardContent>
      </Card>

      {/* Google Drive Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {driveConnected ? <Cloud className="h-4 w-4 text-blue-500" /> : <CloudOff className="h-4 w-4" />}
            Google Drive Backup
          </CardTitle>
          <CardDescription>
            Back up your data to Google Drive and restore it on any browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Google OAuth Client ID</Label>
            <Input
              value={driveClientId}
              onChange={e => setDriveClientIdLocal(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
              className="font-mono text-xs"
            />
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Create one at{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="underline">
                Google Cloud Console
              </a>
              {' '}→ OAuth 2.0 Client ID (Web application)
            </p>
          </div>

          {driveConnected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="success">Connected</Badge>
                {lastBackup && (
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    Last backup: {new Date(lastBackup).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={handleDriveBackup} disabled={driveLoading}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Backup to Drive
                </Button>
                <Button variant="outline" size="sm" onClick={handleDriveRestore} disabled={driveLoading}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Restore from Drive
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDriveDisconnect} className="text-neutral-400 dark:text-neutral-500">
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleDriveConnect} disabled={driveLoading || !driveClientId.trim()}>
              <Cloud className="h-3.5 w-3.5 mr-1" /> Connect Google Drive
            </Button>
          )}

          {driveStatus && (
            <p className={`text-sm ${driveStatus.includes('fail') || driveStatus.includes('Failed') ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {driveStatus}
            </p>
          )}
        </CardContent>
      </Card>

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
          {importError && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Failed to import. Please check the file format.
            </p>
          )}

          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-3 mt-3">
            <Button variant="destructive" onClick={handleClearData} className="w-full justify-start">
              <Trash2 className="h-4 w-4 mr-2" /> Clear All Data
            </Button>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> This will permanently delete all your data from this browser
            </p>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}
