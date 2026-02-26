export interface Investment {
  id?: number
  category: 'retirement' | 'emergency'
  assetClass: 'equity' | 'debt' | 'fixed'
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
  age: number
  beginningAssets: number
  growthReduction: number
  yearEndAssets: number
  liabilities: number
  netWorth: number
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
