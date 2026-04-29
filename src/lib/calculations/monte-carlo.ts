/**
 * Monte Carlo FI Simulation
 *
 * Runs N simulations with normally-distributed annual returns to estimate
 * the probability of reaching FI by various years and the range of outcomes.
 *
 * Uses a seeded PRNG (Mulberry32) so results are reproducible given
 * the same seed, with no external dependencies.
 */

export interface MonteCarloParams {
  currentAssets: number
  monthlySIP: number
  annualSIPIncrease: number   // e.g. 0.10
  expectedReturn: number       // e.g. 0.12 (mean annual)
  returnStdDev: number         // e.g. 0.15 (15% standard deviation)
  monthlyExpenses: number
  expenseInflation: number     // e.g. 0.07
  yearsToProject: number       // e.g. 30
  fiMultiplier: number         // e.g. 25
  numSimulations: number       // e.g. 500
  seed?: number                // optional PRNG seed
}

export interface MonteCarloYearData {
  year: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  fiTarget: number
  successRate: number  // 0-1, fraction of sims that reached FI by this year
}

export interface MonteCarloResult {
  yearData: MonteCarloYearData[]
  overallSuccessRate: number    // fraction of sims that reach FI within the projection window
  medianFIYear: number | null   // median year FI is reached (null if < 50% succeed)
  p10FIYear: number | null      // optimistic (90th percentile of FI years)
  p90FIYear: number | null      // pessimistic (10th percentile)
}

/**
 * Mulberry32 — a simple seeded 32-bit PRNG.
 * Returns a function that yields [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Box-Muller transform: generate normally distributed random variable
 * from two uniform [0,1) values.
 */
function normalRandom(rand: () => number, mean: number, stdDev: number): number {
  const u1 = rand()
  const u2 = rand()
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2)
  return mean + stdDev * z
}

export function runMonteCarlo(params: MonteCarloParams): MonteCarloResult {
  const {
    currentAssets,
    monthlySIP,
    annualSIPIncrease,
    expectedReturn,
    returnStdDev,
    monthlyExpenses,
    expenseInflation,
    yearsToProject,
    fiMultiplier,
    numSimulations,
    seed = 42,
  } = params

  const rand = mulberry32(seed)
  const currentYear = new Date().getFullYear()

  // Each simulation produces an array of portfolio values per year
  // and the year FI was first reached (or null)
  const simPortfolios: number[][] = []
  const simFIYears: (number | null)[] = []

  // Pre-compute FI targets for each year
  let annualExpenses = monthlyExpenses * 12
  const fiTargets: number[] = []
  for (let y = 0; y <= yearsToProject; y++) {
    fiTargets.push(annualExpenses * fiMultiplier)
    annualExpenses *= (1 + expenseInflation)
  }

  for (let sim = 0; sim < numSimulations; sim++) {
    let portfolio = currentAssets
    let sip = monthlySIP
    const yearlyPortfolio: number[] = [portfolio]
    let fiYear: number | null = null

    for (let y = 1; y <= yearsToProject; y++) {
      // Draw annual return from normal distribution
      const annualReturn = normalRandom(rand, expectedReturn, returnStdDev)
      const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1

      // Simulate 12 months
      for (let m = 0; m < 12; m++) {
        portfolio = portfolio * (1 + monthlyReturn) + sip
      }
      // Ensure portfolio doesn't go negative (floor at 0)
      portfolio = Math.max(0, portfolio)

      yearlyPortfolio.push(portfolio)

      if (fiYear === null && portfolio >= fiTargets[y]) {
        fiYear = currentYear + y
      }

      // Annual SIP step-up
      sip *= (1 + annualSIPIncrease)
    }

    simPortfolios.push(yearlyPortfolio)
    simFIYears.push(fiYear)
  }

  // Compute percentiles per year
  const yearData: MonteCarloYearData[] = []
  for (let y = 0; y <= yearsToProject; y++) {
    const values = simPortfolios.map(sp => sp[y]).sort((a, b) => a - b)
    const n = values.length

    const idx = (p: number) => Math.min(Math.floor(p * n), n - 1)
    const successCount = simPortfolios.filter(sp => {
      // Check if FI was reached by year y
      for (let yy = 0; yy <= y; yy++) {
        if (sp[yy] >= fiTargets[yy]) return true
      }
      return false
    }).length

    yearData.push({
      year: currentYear + y,
      p10: Math.round(values[idx(0.10)]),
      p25: Math.round(values[idx(0.25)]),
      p50: Math.round(values[idx(0.50)]),
      p75: Math.round(values[idx(0.75)]),
      p90: Math.round(values[idx(0.90)]),
      fiTarget: Math.round(fiTargets[y]),
      successRate: successCount / n,
    })
  }

  // Overall success rate
  const successfulSims = simFIYears.filter(y => y !== null).length
  const overallSuccessRate = successfulSims / numSimulations

  // FI year distribution
  const fiYearsOnly = simFIYears.filter((y): y is number => y !== null).sort((a, b) => a - b)
  const medianFIYear = fiYearsOnly.length > 0
    ? fiYearsOnly[Math.floor(fiYearsOnly.length * 0.5)]
    : null
  const p10FIYear = fiYearsOnly.length > 0
    ? fiYearsOnly[Math.floor(fiYearsOnly.length * 0.1)]
    : null
  const p90FIYear = fiYearsOnly.length > 0
    ? fiYearsOnly[Math.min(Math.floor(fiYearsOnly.length * 0.9), fiYearsOnly.length - 1)]
    : null

  return {
    yearData,
    overallSuccessRate,
    medianFIYear,
    p10FIYear,
    p90FIYear,
  }
}
