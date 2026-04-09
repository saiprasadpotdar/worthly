/**
 * Coast FI & Barista FI Calculations
 *
 * Coast FI: The portfolio needed today so that, with zero new contributions,
 * compounding alone reaches your (inflation-adjusted) FI target by retirement age.
 *
 * Barista FI: The FI target when part-time income covers part of your expenses,
 * meaning you need a smaller corpus.
 */

export interface CoastFIResult {
  coastFITarget: number         // today's rupees needed now to coast to FI
  futureFITarget: number        // inflation-adjusted FI target at retirement
  realReturn: number            // inflation-adjusted return used in discounting
  coastFIReached: boolean
  coastFIProgress: number       // 0-1
}

export interface BaristaFIResult {
  baristaFITarget: number
  baristaFIReached: boolean
  baristaFIProgress: number // 0-1
  annualGap: number // annual expenses minus part-time income
}

/**
 * Real (inflation-adjusted) return rate.
 * realReturn = (1 + nominal) / (1 + inflation) - 1
 */
export function realReturnRate(nominalReturn: number, inflationRate: number): number {
  return (1 + nominalReturn) / (1 + inflationRate) - 1
}

function safeProgress(numerator: number, denominator: number): number {
  if (!isFinite(numerator) || !isFinite(denominator) || denominator <= 0) return 0
  const p = numerator / denominator
  if (!isFinite(p) || p < 0) return 0
  return Math.min(1, p)
}

/**
 * Calculate Coast FI target (in today's rupees).
 *
 * Because expenses inflate over time, the FI target at retirement will be larger
 * than today's target. Coast FI must therefore be discounted using the REAL
 * return rate (nominal return adjusted for expense inflation) — equivalently:
 *
 *   futureFITarget = todayFITarget * (1 + expenseInflation)^years
 *   coastFITarget  = futureFITarget / (1 + nominalReturn)^years
 *                  = todayFITarget / (1 + realReturn)^years
 */
export function calculateCoastFI(
  todayFITarget: number,
  currentPortfolio: number,
  nominalReturn: number,
  expenseInflation: number,
  yearsToRetirement: number,
): CoastFIResult {
  const realReturn = realReturnRate(nominalReturn, expenseInflation)

  if (yearsToRetirement <= 0) {
    return {
      coastFITarget: Math.round(todayFITarget),
      futureFITarget: Math.round(todayFITarget),
      realReturn,
      coastFIReached: currentPortfolio >= todayFITarget,
      coastFIProgress: safeProgress(currentPortfolio, todayFITarget),
    }
  }

  const futureFITarget = todayFITarget * Math.pow(1 + expenseInflation, yearsToRetirement)
  const coastFITarget = futureFITarget / Math.pow(1 + nominalReturn, yearsToRetirement)

  return {
    coastFITarget: Math.round(coastFITarget),
    futureFITarget: Math.round(futureFITarget),
    realReturn,
    coastFIReached: currentPortfolio >= coastFITarget,
    coastFIProgress: safeProgress(currentPortfolio, coastFITarget),
  }
}

/**
 * Calculate Barista FI target (in today's rupees).
 * baristaFI = (annualExpenses - partTimeAnnualIncome) * fiMultiplier
 * Assumes part-time income grows with inflation alongside expenses, so both
 * sides stay in "today's rupees" and the SWR (1/fiMultiplier) handles future growth.
 * If part-time income covers all expenses, barista FI target is 0.
 */
export function calculateBaristaFI(
  annualExpenses: number,
  partTimeMonthlyIncome: number,
  currentPortfolio: number,
  fiMultiplier: number,
): BaristaFIResult {
  const partTimeAnnual = partTimeMonthlyIncome * 12
  const annualGap = Math.max(0, annualExpenses - partTimeAnnual)
  const baristaFITarget = Math.round(annualGap * fiMultiplier)
  const reached = currentPortfolio >= baristaFITarget
  const progress = baristaFITarget > 0 ? safeProgress(currentPortfolio, baristaFITarget) : 1
  return { baristaFITarget, baristaFIReached: reached, baristaFIProgress: progress, annualGap }
}
