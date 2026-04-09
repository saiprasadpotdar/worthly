'use client'

import { useState } from 'react'
import { useLiveQuery } from '@/hooks/useLiveQuery'
import { useMasked } from '@/hooks/useMasked'
import { db } from '@/lib/db'
import { formatPercent } from '@/lib/utils'
import type { Loan, Property } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Plus, Trash2, Edit2, Landmark, Home } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useConfirm } from '@/hooks/useConfirm'

const emptyLoan: Omit<Loan, 'id'> = {
  name: '', type: 'home', principal: 0, balance: 0, interestRate: 0, emi: 0, startDate: '', endDate: '',
}

const emptyProperty: Omit<Property, 'id'> = {
  name: '', location: '', carpetSqft: 0, purchaseDate: '', totalCost: 0,
  loanBank: '', loanAmount: 0, outstandingPrincipal: 0, currentMarketValue: 0,
}

export default function LiabilitiesPage() {
  const loans = useLiveQuery(() => db.loans.toArray(), [])
  const properties = useLiveQuery(() => db.properties.toArray(), [])
  const [showLoanForm, setShowLoanForm] = useState(false)
  const [showPropertyForm, setShowPropertyForm] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [loanForm, setLoanForm] = useState(emptyLoan)
  const [propertyForm, setPropertyForm] = useState(emptyProperty)
  const { confirm, confirmProps } = useConfirm()
  const { fmt: formatCurrency } = useMasked()

  const lns = loans ?? []
  const props = properties ?? []
  const totalBalance = lns.reduce((s, l) => s + l.balance, 0)
  const totalEMI = lns.reduce((s, l) => s + l.emi, 0)
  const totalPropertyValue = props.reduce((s, p) => s + p.currentMarketValue, 0)

  // Loan CRUD
  function openAddLoan() { setLoanForm(emptyLoan); setEditingLoan(null); setShowLoanForm(true) }
  function openEditLoan(item: Loan) {
    setLoanForm({ name: item.name, type: item.type, principal: item.principal, balance: item.balance, interestRate: item.interestRate, emi: item.emi, startDate: item.startDate, endDate: item.endDate })
    setEditingLoan(item); setShowLoanForm(true)
  }
  async function saveLoan() {
    if (!loanForm.name) return
    if (editingLoan?.id) await db.loans.update(editingLoan.id, loanForm)
    else await db.loans.add({ ...loanForm })
    setShowLoanForm(false)
  }
  async function deleteLoan(id: number) {
    const ok = await confirm({ title: 'Delete loan?', description: 'This loan entry will be permanently removed.', variant: 'destructive', confirmLabel: 'Delete' })
    if (ok) await db.loans.delete(id)
  }

  // Property CRUD
  function openAddProperty() { setPropertyForm(emptyProperty); setEditingProperty(null); setShowPropertyForm(true) }
  function openEditProperty(item: Property) {
    setPropertyForm({ name: item.name, location: item.location, carpetSqft: item.carpetSqft, purchaseDate: item.purchaseDate, totalCost: item.totalCost, loanBank: item.loanBank, loanAmount: item.loanAmount, outstandingPrincipal: item.outstandingPrincipal, currentMarketValue: item.currentMarketValue })
    setEditingProperty(item); setShowPropertyForm(true)
  }
  async function saveProperty() {
    if (!propertyForm.name) return
    if (editingProperty?.id) await db.properties.update(editingProperty.id, propertyForm)
    else await db.properties.add({ ...propertyForm })
    setShowPropertyForm(false)
  }
  async function deleteProperty(id: number) {
    const ok = await confirm({ title: 'Delete property?', description: 'This property entry will be permanently removed.', variant: 'destructive', confirmLabel: 'Delete' })
    if (ok) await db.properties.delete(id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Liabilities</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Track your loans and properties</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Total Outstanding</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalBalance, true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Monthly EMI</p>
            <p className="text-xl font-bold">{formatCurrency(totalEMI)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Property Value</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPropertyValue, true)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openAddLoan} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Loan</Button>
          </div>
          {lns.length === 0 ? (
            <EmptyState icon={<Landmark className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />} title="No loans tracked" description="Add your loans to track outstanding balances and EMIs." actionLabel="Add Loan" onAction={openAddLoan} />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 dark:border-neutral-800">
                        <th className="text-left p-4 font-medium text-neutral-500 dark:text-neutral-400">Loan</th>
                        <th className="text-left p-4 font-medium text-neutral-500 dark:text-neutral-400">Type</th>
                        <th className="text-right p-4 font-medium text-neutral-500 dark:text-neutral-400">Principal</th>
                        <th className="text-right p-4 font-medium text-neutral-500 dark:text-neutral-400">Balance</th>
                        <th className="text-right p-4 font-medium text-neutral-500 dark:text-neutral-400">Rate</th>
                        <th className="text-right p-4 font-medium text-neutral-500 dark:text-neutral-400">EMI</th>
                        <th className="text-right p-4 font-medium text-neutral-500 dark:text-neutral-400">Repaid</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lns.map(loan => {
                        const repaid = loan.principal > 0 ? (loan.principal - loan.balance) / loan.principal : 0
                        return (
                          <tr key={loan.id} className="border-b border-neutral-50 dark:border-neutral-800 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                            <td className="p-4 font-medium">{loan.name}</td>
                            <td className="p-4"><Badge>{loan.type}</Badge></td>
                            <td className="p-4 text-right">{formatCurrency(loan.principal)}</td>
                            <td className="p-4 text-right font-medium text-red-600">{formatCurrency(loan.balance)}</td>
                            <td className="p-4 text-right">{loan.interestRate}%</td>
                            <td className="p-4 text-right">{formatCurrency(loan.emi)}</td>
                            <td className="p-4 text-right">
                              <Badge variant={repaid > 0.5 ? 'success' : 'warning'}>{formatPercent(repaid)}</Badge>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openEditLoan(loan)} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"><Edit2 className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" /></button>
                                <button onClick={() => loan.id && deleteLoan(loan.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
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
          )}
        </TabsContent>

        <TabsContent value="properties" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openAddProperty} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Property</Button>
          </div>
          {props.length === 0 ? (
            <EmptyState icon={<Home className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />} title="No properties tracked" description="Add your properties to track real asset value." actionLabel="Add Property" onAction={openAddProperty} />
          ) : (
            <div className="grid gap-4">
              {props.map(prop => (
                <Card key={prop.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{prop.name}</h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{prop.location}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditProperty(prop)} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"><Edit2 className="h-4 w-4 text-neutral-400 dark:text-neutral-500" /></button>
                        <button onClick={() => prop.id && deleteProperty(prop.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950"><Trash2 className="h-4 w-4 text-red-400" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Total Cost</p>
                        <p className="font-medium">{formatCurrency(prop.totalCost)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Market Value</p>
                        <p className="font-medium text-emerald-600">{formatCurrency(prop.currentMarketValue)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Loan Outstanding</p>
                        <p className="font-medium text-red-600">{formatCurrency(prop.outstandingPrincipal)}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Carpet Area</p>
                        <p className="font-medium">{prop.carpetSqft} sq ft</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Loan Dialog */}
      <Dialog open={showLoanForm} onClose={() => setShowLoanForm(false)} title={editingLoan ? 'Edit Loan' : 'Add Loan'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Loan Name</Label><Input value={loanForm.name} onChange={e => setLoanForm({ ...loanForm, name: e.target.value })} placeholder="e.g., Home Loan - SBI" /></div>
            <div><Label>Type</Label><Select value={loanForm.type} onChange={e => setLoanForm({ ...loanForm, type: e.target.value as any })}>
              <option value="home">Home</option><option value="personal">Personal</option><option value="vehicle">Vehicle</option><option value="education">Education</option><option value="other">Other</option>
            </Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Principal Amount</Label><Input type="number" value={loanForm.principal || ''} onChange={e => setLoanForm({ ...loanForm, principal: Number(e.target.value) })} /></div>
            <div><Label>Current Balance</Label><Input type="number" value={loanForm.balance || ''} onChange={e => setLoanForm({ ...loanForm, balance: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Interest Rate (%)</Label><Input type="number" step="0.01" value={loanForm.interestRate || ''} onChange={e => setLoanForm({ ...loanForm, interestRate: Number(e.target.value) })} /></div>
            <div><Label>Monthly EMI</Label><Input type="number" value={loanForm.emi || ''} onChange={e => setLoanForm({ ...loanForm, emi: Number(e.target.value) })} /></div>
            <div><Label>Start Date</Label><Input type="date" value={loanForm.startDate} onChange={e => setLoanForm({ ...loanForm, startDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowLoanForm(false)}>Cancel</Button>
            <Button onClick={saveLoan}>{editingLoan ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Dialog>

      {/* Property Dialog */}
      <Dialog open={showPropertyForm} onClose={() => setShowPropertyForm(false)} title={editingProperty ? 'Edit Property' : 'Add Property'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Property Name</Label><Input value={propertyForm.name} onChange={e => setPropertyForm({ ...propertyForm, name: e.target.value })} placeholder="e.g., E-704, Austin Arena" /></div>
            <div><Label>Location</Label><Input value={propertyForm.location} onChange={e => setPropertyForm({ ...propertyForm, location: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Carpet Area (sqft)</Label><Input type="number" value={propertyForm.carpetSqft || ''} onChange={e => setPropertyForm({ ...propertyForm, carpetSqft: Number(e.target.value) })} /></div>
            <div><Label>Purchase Date</Label><Input type="date" value={propertyForm.purchaseDate} onChange={e => setPropertyForm({ ...propertyForm, purchaseDate: e.target.value })} /></div>
            <div><Label>Total Cost</Label><Input type="number" value={propertyForm.totalCost || ''} onChange={e => setPropertyForm({ ...propertyForm, totalCost: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Loan Bank</Label><Input value={propertyForm.loanBank} onChange={e => setPropertyForm({ ...propertyForm, loanBank: e.target.value })} /></div>
            <div><Label>Loan Amount</Label><Input type="number" value={propertyForm.loanAmount || ''} onChange={e => setPropertyForm({ ...propertyForm, loanAmount: Number(e.target.value) })} /></div>
            <div><Label>Outstanding</Label><Input type="number" value={propertyForm.outstandingPrincipal || ''} onChange={e => setPropertyForm({ ...propertyForm, outstandingPrincipal: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label>Current Market Value</Label>
            <Input type="number" value={propertyForm.currentMarketValue || ''} onChange={e => setPropertyForm({ ...propertyForm, currentMarketValue: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowPropertyForm(false)}>Cancel</Button>
            <Button onClick={saveProperty}>{editingProperty ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}
