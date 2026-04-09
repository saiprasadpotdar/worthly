/**
 * FI Projections Engine
 *
 * Projects future portfolio value and estimates when FI will be reached
 * based on current assets, SIPs, income growth, and expected returns.
 */

export interface ProjectionParams {
  currentAssets: number
  monthlySIP: number
  annualSIPIncrease: number   // e.g. 0.10 = 10% step-up per year
  expectedReturn: number       // e.g. 0.12 = 12% annual
  inflationRate: number        // e.g. 0.06 = 6%
  monthlyExpenses: number
  expenseInflation: number     // e.g. 0.07 = 7%
  yearsToProject: number       // e.g. 30
  fiMultiplier: number         // e.g. 25 (25x annual expenses = Regular FI)
}

export interface ProjectionYear {
  year: number
  age?: number
  portfolioValue: number
  totalInvested: number
  totalReturns: number
  annualExpenses: number
  fiTarget: number
  fiReached: boolean
  monthlySIP: number
}

export interface ProjectionResult {
  projections: ProjectionYear[]
  fiYear: number | null          // year when FI is reached, null if not within projection
  fiAge: number | null
  totalInvested: number
  finalPortfolio: number
  finalFITarget: number
}

export function runProjection(params: ProjectionParams, birthYear?: number): ProjectionResult {
  const {
    currentAssets,
    monthlySIP,
    annualSIPIncrease,
    expectedReturn,
    inflationRate,
    monthlyExpenses,
    expenseInflation,
    yearsToProject,
    fiMultiplier,
  } = params

  const currentYear = new Date().getFullYear()
  const monthlyReturn = expectedReturn / 12
  const projections: ProjectionYear[] = []

  let portfolio = currentAssets
  let totalInvested = currentAssets
  let currentSIP = monthlySIP
  let currentAnnualExpenses = monthlyExpenses * 12
  let fiYear: number | null = null
  let fiAge: number | null = null

  for (let y = 0; y <= yearsToProject; y++) {
    const yearNum = currentYear + y
    const fiTarget = currentAnnualExpenses * fiMultiplier
    const reached = portfolio >= fiTarget

    const age = birthYear ? yearNum - birthYear : undefined

    projections.push({
      year: yearNum,
      age,
      portfolioValue: Math.round(portfolio),
      totalInvested: Math.round(totalInvested),
      totalReturns: Math.round(portfolio - totalInvested),
      annualExpenses: Math.round(currentAnnualExpenses),
      fiTarget: Math.round(fiTarget),
      fiReached: reached,
      monthlySIP: Math.round(currentSIP),
    })

    if (reached && fiYear === null) {
      fiYear = yearNum
      fiAge = age ?? null
    }

    // Simulate 12 months of SIP + returns
    for (let m = 0; m < 12; m++) {
      portfolio = portfolio * (1 + monthlyReturn) + currentSIP
      totalInvested += currentSIP
    }

    // Annual step-up and inflation
    currentSIP = currentSIP * (1 + annualSIPIncrease)
    currentAnnualExpenses = currentAnnualExpenses * (1 + expenseInflation)
  }

  return {
    projections,
    fiYear,
    fiAge,
    totalInvested: Math.round(totalInvested),
    finalPortfolio: Math.round(portfolio),
    finalFITarget: Math.round(projections[projections.length - 1]?.fiTarget ?? 0),
  }
}

/**
 * Run multiple scenarios for comparison
 */
export interface Scenario {
  name: string
  params: ProjectionParams
  color: string
}

export function runScenarios(scenarios: Scenario[], birthYear?: number): { name: string; color: string; result: ProjectionResult }[] {
  return scenarios.map(s => ({
    name: s.name,
    color: s.color,
    result: runProjection(s.params, birthYear),
  }))
}
