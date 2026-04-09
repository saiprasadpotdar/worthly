import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function exportToJSON(): Promise<string> {
  const data = {
    version: 3,
    exportDate: new Date().toISOString(),
    goals: await db.goals.toArray(),
    investments: await db.investments.toArray(),
    sips: await db.sips.toArray(),
    loans: await db.loans.toArray(),
    properties: await db.properties.toArray(),
    incomeEntries: await db.incomeEntries.toArray(),
    annualIncomes: await db.annualIncomes.toArray(),
    fiGoals: await db.fiGoals.toArray(),
    userProfile: await db.userProfile.toArray(),
    milestones: await db.milestones.toArray(),
    netWorthSnapshots: await db.netWorthSnapshots.toArray(),
  }
  return JSON.stringify(data, null, 2)
}

export async function importFromJSON(jsonStr: string): Promise<void> {
  const data = JSON.parse(jsonStr)
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
    }
    if (data.goals) await db.goals.bulkAdd(data.goals.map(({ id, ...rest }: any) => rest))
    if (data.investments) await db.investments.bulkAdd(data.investments.map(({ id, ...rest }: any) => rest))
    if (data.sips) await db.sips.bulkAdd(data.sips.map(({ id, ...rest }: any) => rest))
    if (data.loans) await db.loans.bulkAdd(data.loans.map(({ id, ...rest }: any) => rest))
    if (data.properties) await db.properties.bulkAdd(data.properties.map(({ id, ...rest }: any) => rest))
    if (data.incomeEntries) await db.incomeEntries.bulkAdd(data.incomeEntries.map(({ id, ...rest }: any) => rest))
    if (data.annualIncomes) await db.annualIncomes.bulkAdd(data.annualIncomes.map(({ id, ...rest }: any) => rest))
    if (data.fiGoals) await db.fiGoals.bulkAdd(data.fiGoals.map(({ id, ...rest }: any) => rest))
    if (data.userProfile) await db.userProfile.bulkAdd(data.userProfile.map(({ id, ...rest }: any) => rest))
    if (data.milestones) await db.milestones.bulkAdd(data.milestones.map(({ id, ...rest }: any) => rest))
    if (data.netWorthSnapshots) await db.netWorthSnapshots.bulkAdd(data.netWorthSnapshots.map(({ id, ...rest }: any) => rest))
  })
}

export async function exportToXLSX(): Promise<Blob> {
  const wb = XLSX.utils.book_new()
  
  const investments = await db.investments.toArray()
  if (investments.length) {
    const ws = XLSX.utils.json_to_sheet(investments)
    XLSX.utils.book_append_sheet(wb, ws, 'Investments')
  }
  
  const loans = await db.loans.toArray()
  if (loans.length) {
    const ws = XLSX.utils.json_to_sheet(loans)
    XLSX.utils.book_append_sheet(wb, ws, 'Loans')
  }
  
  const annualIncomes = await db.annualIncomes.toArray()
  if (annualIncomes.length) {
    const ws = XLSX.utils.json_to_sheet(annualIncomes)
    XLSX.utils.book_append_sheet(wb, ws, 'Income')
  }
  
  const snapshots = await db.netWorthSnapshots.toArray()
  if (snapshots.length) {
    const ws = XLSX.utils.json_to_sheet(snapshots)
    XLSX.utils.book_append_sheet(wb, ws, 'Net Worth')
  }
  
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJSON(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, filename)
}
