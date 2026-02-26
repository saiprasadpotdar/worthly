import Dexie, { type EntityTable } from 'dexie'
import type { Investment, Loan, Property, IncomeEntry, AnnualIncome, FIGoal, UserProfile, Milestone, NetWorthSnapshot } from '@/types'

const db = new Dexie('WorthlyDB') as Dexie & {
  investments: EntityTable<Investment, 'id'>
  loans: EntityTable<Loan, 'id'>
  properties: EntityTable<Property, 'id'>
  incomeEntries: EntityTable<IncomeEntry, 'id'>
  annualIncomes: EntityTable<AnnualIncome, 'id'>
  fiGoals: EntityTable<FIGoal, 'id'>
  userProfile: EntityTable<UserProfile, 'id'>
  milestones: EntityTable<Milestone, 'id'>
  netWorthSnapshots: EntityTable<NetWorthSnapshot, 'id'>
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

export { db }
