export interface Goal {
  id?: number
  name: string
  targetCorpus?: number
  targetYear?: number
  color?: string
}

export interface Investment {
  id?: number
  goal: string
  assetClass: 'equity' | 'debt' | 'fixed' | 'real_estate' | 'epf' | 'ppf' | 'nps'
  instrument: string
  investedValue: number
  currentValue: number
  startDate: string
  platform?: string
}

export interface Loan {
  id?: number
  name: string
  type: 'home' | 'personal' | 'vehicle' | 'education' | 'other'
  principal: number
  balance: number
  interestRate: number
  emi: number
  startDate: string
  endDate?: string
}

export interface Property {
  id?: number
  name: string
  location: string
  carpetSqft: number
  purchaseDate: string
  totalCost: number
  loanBank: string
  loanAmount: number
  outstandingPrincipal: number
  currentMarketValue: number
}

export interface IncomeEntry {
  id?: number
  year: string
  month: number // 0-11
  salary: number
  incentives: number
  otherIncome: number
  tds: number
}

export interface AnnualIncome {
  id?: number
  year: string
  grossSalary: number
  taxes: number
  netIncome: number
}

export interface FIGoal {
  id?: number
  name: string
  targetYear: number
  targetCorpus: number
  inflation: number
}

export interface UserProfile {
  id?: number
  name: string
  startDate: string
  birthYear: number
  monthlyExpenses: number
  monthlyEmi: number
  desiredEquityRatio: number
  desiredDebtRatio: number
  desiredLiquidToNW: number
  desiredRealToNW: number
  desiredSavingsToIncome: number
  desiredLoanToAsset: number
  fiMultiplier?: number // Regular FI = annualExpenses × fiMultiplier (default 25 = 4% SWR)
  retirementAge?: number // Target retirement age for Coast FI (default 50)
  passkey?: string // SHA-256 hash of user's passkey
}

export interface Milestone {
  id?: number
  label: string
  amount: number
  achievedDate?: string
  monthsTaken?: number
}

export interface NetWorthSnapshot {
  id?: number
  year: number
  month: number // 1-12
  date: string // YYYY-MM-DD
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  equity: number
  debt: number
  realAssets: number
}

export interface SIP {
  id?: number
  goal: string
  instrument: string
  amount: number
  dayOfMonth: number // 1-28
  assetClass: 'equity' | 'debt' | 'fixed' | 'real_estate' | 'epf' | 'ppf' | 'nps'
  platform?: string
  startDate: string
  active: boolean
}

export interface DashboardData {
  totalEquity: number
  totalDebt: number
  totalLiquidAssets: number
  totalRealAssets: number
  totalMetals: number
  totalLiabilities: number
  netWorth: number
  monthlyIncome: number
  monthlySavings: number
  monthlyEmi: number
  leanFITarget: number
  regularFITarget: number
  fatFITarget: number
  retirementCorpus: number
  emergencyFund: number
  fiProgress: number
}
