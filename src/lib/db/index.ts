import Dexie, { type EntityTable } from 'dexie'
import type { Goal, Investment, Loan, Property, IncomeEntry, AnnualIncome, FIGoal, UserProfile, Milestone, NetWorthSnapshot, SIP } from '@/types'

const db = new Dexie('WorthlyDB') as Dexie & {
  goals: EntityTable<Goal, 'id'>
  investments: EntityTable<Investment, 'id'>
  loans: EntityTable<Loan, 'id'>
  properties: EntityTable<Property, 'id'>
  incomeEntries: EntityTable<IncomeEntry, 'id'>
  annualIncomes: EntityTable<AnnualIncome, 'id'>
  fiGoals: EntityTable<FIGoal, 'id'>
  userProfile: EntityTable<UserProfile, 'id'>
  milestones: EntityTable<Milestone, 'id'>
  netWorthSnapshots: EntityTable<NetWorthSnapshot, 'id'>
  sips: EntityTable<SIP, 'id'>
}

db.version(1).stores({
  investments: '++id, category, assetClass',
  loans: '++id, type',
  properties: '++id',
  incomeEntries: '++id, year, month',
  annualIncomes: '++id, year',
  fiGoals: '++id, name',
  userProfile: '++id',
  milestones: '++id, label',
  netWorthSnapshots: '++id, year',
})

db.version(2).stores({
  goals: '++id, name',
  investments: '++id, goal, assetClass',
  loans: '++id, type',
  properties: '++id',
  incomeEntries: '++id, year, month',
  annualIncomes: '++id, year',
  fiGoals: '++id, name',
  userProfile: '++id',
  milestones: '++id, label',
  netWorthSnapshots: '++id, year',
}).upgrade(tx => {
  return tx.table('investments').toCollection().modify(inv => {
    if ('category' in inv) {
      inv.goal = inv.category
      delete inv.category
    }
  })
})

db.version(3).stores({
  goals: '++id, name',
  investments: '++id, goal, assetClass',
  loans: '++id, type',
  properties: '++id',
  incomeEntries: '++id, year, month',
  annualIncomes: '++id, year',
  fiGoals: '++id, name',
  userProfile: '++id',
  milestones: '++id, label, amount',
  netWorthSnapshots: '++id, [year+month], date',
  sips: '++id, goal, active',
}).upgrade(tx => {
  // Migrate old netWorthSnapshots to new format
  return tx.table('netWorthSnapshots').toCollection().modify(snap => {
    if (!('month' in snap)) {
      snap.month = 12
      snap.date = `${snap.year}-12-01`
      snap.totalAssets = snap.yearEndAssets ?? 0
      snap.totalLiabilities = snap.liabilities ?? 0
      snap.equity = 0
      snap.debt = 0
      snap.realAssets = 0
    }
  })
})

export { db }

// Seed default goals if empty
export async function seedDefaultGoals() {
  const count = await db.goals.count()
  if (count === 0) {
    await db.goals.bulkAdd([
      { name: 'Retirement' },
      { name: 'Emergency' },
    ])
  }
}

// Seed default milestones if empty + deduplicate existing
export async function seedDefaultMilestones() {
  const defaults = [
    { label: '₹1 Lakh', amount: 100000 },
    { label: '₹5 Lakh', amount: 500000 },
    { label: '₹10 Lakh', amount: 1000000 },
    { label: '₹25 Lakh', amount: 2500000 },
    { label: '₹50 Lakh', amount: 5000000 },
    { label: '₹1 Crore', amount: 10000000 },
    { label: '₹2 Crore', amount: 20000000 },
    { label: '₹5 Crore', amount: 50000000 },
  ]

  const existing = await db.milestones.toArray()

  // Deduplicate: keep only one entry per amount
  const seenAmounts = new Set<number>()
  const toDelete: number[] = []
  for (const m of existing) {
    if (seenAmounts.has(m.amount)) {
      if (m.id) toDelete.push(m.id)
    } else {
      seenAmounts.add(m.amount)
    }
  }
  if (toDelete.length > 0) {
    await db.milestones.bulkDelete(toDelete)
  }

  // Seed any missing defaults
  if (existing.length === 0) {
    await db.milestones.bulkAdd(defaults)
  }
}

// Capture a net worth snapshot for the current month
export async function captureSnapshot() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Check if snapshot for this month already exists
  const existing = await db.netWorthSnapshots
    .where('[year+month]')
    .equals([year, month])
    .first()

  const investments = await db.investments.toArray()
  const loans = await db.loans.toArray()
  const properties = await db.properties.toArray()

  const equity = investments.filter(i => i.assetClass === 'equity').reduce((s, i) => s + i.currentValue, 0)
  const debt = investments.filter(i => i.assetClass === 'debt' || i.assetClass === 'fixed' || i.assetClass === 'epf' || i.assetClass === 'ppf' || i.assetClass === 'nps').reduce((s, i) => s + i.currentValue, 0)
  const liquidAssets = investments.filter(i => i.assetClass !== 'real_estate').reduce((s, i) => s + i.currentValue, 0)
  const invRealEstate = investments.filter(i => i.assetClass === 'real_estate').reduce((s, i) => s + i.currentValue, 0)
  const realAssets = properties.reduce((s, p) => s + p.currentMarketValue, 0) + invRealEstate
  const totalAssets = liquidAssets + realAssets
  const propertyMortgages = properties.reduce((s, p) => s + (p.outstandingPrincipal || 0), 0)
  const totalLiabilities = loans.reduce((s, l) => s + l.balance, 0) + propertyMortgages
  const netWorth = totalAssets - totalLiabilities

  const snap: Omit<NetWorthSnapshot, 'id'> = {
    year,
    month,
    date: `${year}-${String(month).padStart(2, '0')}-01`,
    totalAssets,
    totalLiabilities,
    netWorth,
    equity,
    debt,
    realAssets,
  }

  if (existing?.id) {
    await db.netWorthSnapshots.update(existing.id, snap)
  } else {
    await db.netWorthSnapshots.add(snap)
  }

  // Check and write milestone achievements
  const milestones = await db.milestones.toArray()
  const allSnapshots = await db.netWorthSnapshots.orderBy('date').toArray()
  const firstSnap = allSnapshots[0]

  for (const m of milestones) {
    if (totalAssets >= m.amount && !m.achievedDate && m.id) {
      const monthsTaken = firstSnap
        ? Math.round(((year - firstSnap.year) * 12 + (month - firstSnap.month)))
        : 0
      await db.milestones.update(m.id, {
        achievedDate: `${year}-${String(month).padStart(2, '0')}-01`,
        monthsTaken: Math.max(0, monthsTaken),
      })
    }
  }
}
