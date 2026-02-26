import type { DashboardData } from '@/types'

export function calculateLeanFI(annualExpenses: number, multiplier = 50): number {
  return annualExpenses * multiplier
}

export function calculateRegularFI(leanFI: number): number {
  return leanFI * 2
}

export function calculateFatFI(regularFI: number): number {
  return regularFI * 2
}

export function calculateFIProgress(currentCorpus: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(currentCorpus / target, 1)
}

export function calculateYearsToFI(
  currentCorpus: number,
  targetCorpus: number,
  monthlySavings: number,
  expectedReturn = 0.12
): number {
  if (monthlySavings <= 0) return Infinity
  const monthlyReturn = expectedReturn / 12
  const remaining = targetCorpus - currentCorpus
  if (remaining <= 0) return 0
  const months = Math.log((remaining * monthlyReturn / monthlySavings) + 1) / Math.log(1 + monthlyReturn)
  return months / 12
}

export function calculateYoYGrowthRequired(
  currentCorpus: number,
  targetCorpus: number,
  yearsAway: number
): number {
  if (yearsAway <= 0 || currentCorpus <= 0) return 0
  return Math.pow(targetCorpus / currentCorpus, 1 / yearsAway) - 1
}

export function calculateCorpusMet(current: number, target: number): number {
  if (target <= 0) return 0
  return current / target
}

export function calculateLeanX(monthlyExpenses: number, totalCorpus: number): { perMonth: number; perAnnum: number } {
  if (monthlyExpenses <= 0) return { perMonth: 0, perAnnum: 0 }
  return {
    perMonth: totalCorpus / monthlyExpenses,
    perAnnum: totalCorpus / (monthlyExpenses * 12),
  }
}

export function calculateRatios(data: DashboardData) {
  const totalAssets = data.totalLiquidAssets + data.totalRealAssets + data.totalMetals
  return {
    liquidToNW: data.netWorth > 0 ? data.totalLiquidAssets / data.netWorth : 0,
    realToNW: data.netWorth > 0 ? data.totalRealAssets / data.netWorth : 0,
    savingsToIncome: data.monthlyIncome > 0 ? data.monthlySavings / data.monthlyIncome : 0,
    loanToAsset: totalAssets > 0 ? data.totalLiabilities / totalAssets : 0,
  }
}

export function calculateSavedYears(totalCorpus: number, monthlyExpenses: number): number {
  if (monthlyExpenses <= 0) return 0
  return totalCorpus / (monthlyExpenses * 12)
}
