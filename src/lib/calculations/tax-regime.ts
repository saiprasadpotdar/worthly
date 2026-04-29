/**
 * India Tax Regime Comparison Calculator (4.4)
 *
 * Stateless old-vs-new regime calculator for salaried individuals.
 * FY 2024-25 slabs. Standard deduction of ₹75,000 in new regime, ₹50,000 in old.
 */

export interface TaxInputs {
  grossSalary: number
  hra: number                 // actual HRA exemption (computed outside)
  section80C: number          // max 1.5L
  section80D: number          // health insurance premiums
  npsEmployer80CCD2: number   // employer NPS (up to 14% of basic)
  npsEmployee80CCD1B: number  // additional NPS self (max 50K)
  homeLoanInterest: number    // section 24b (max 2L for self-occupied)
  otherDeductions: number     // any other Chapter VI-A deductions
}

export interface TaxResult {
  oldRegimeTax: number
  newRegimeTax: number
  oldTaxableIncome: number
  newTaxableIncome: number
  oldDeductions: number
  newDeductions: number
  recommendation: 'old' | 'new'
  savings: number             // absolute savings from the better regime
}

/**
 * Old regime slabs (FY 2024-25):
 * 0 - 2.5L     → 0%
 * 2.5L - 5L    → 5%
 * 5L - 10L     → 20%
 * 10L+         → 30%
 */
function computeOldRegimeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0
  let tax = 0
  if (taxableIncome > 1000000) {
    tax += (taxableIncome - 1000000) * 0.30
    taxableIncome = 1000000
  }
  if (taxableIncome > 500000) {
    tax += (taxableIncome - 500000) * 0.20
    taxableIncome = 500000
  }
  if (taxableIncome > 250000) {
    tax += (taxableIncome - 250000) * 0.05
  }
  // Rebate u/s 87A: if taxable income <= 5L, no tax
  if (taxableIncome <= 500000 && tax <= 12500) return 0
  return tax
}

/**
 * New regime slabs (FY 2024-25, updated Budget 2024):
 * 0 - 3L       → 0%
 * 3L - 7L      → 5%
 * 7L - 10L     �� 10%
 * 10L - 12L    → 15%
 * 12L - 15L    → 20%
 * 15L+         → 30%
 */
function computeNewRegimeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0
  let tax = 0
  const slabs = [
    { limit: 300000, rate: 0 },
    { limit: 700000, rate: 0.05 },
    { limit: 1000000, rate: 0.10 },
    { limit: 1200000, rate: 0.15 },
    { limit: 1500000, rate: 0.20 },
    { limit: Infinity, rate: 0.30 },
  ]

  let remaining = taxableIncome
  let prev = 0
  for (const slab of slabs) {
    const bracket = Math.min(remaining, slab.limit - prev)
    if (bracket <= 0) break
    tax += bracket * slab.rate
    remaining -= bracket
    prev = slab.limit
  }

  // Rebate u/s 87A (new regime): if taxable income <= 7L, tax rebate up to ₹25,000
  if (taxableIncome <= 700000) {
    tax = Math.max(0, tax - 25000)
  }

  return tax
}

function addCess(tax: number): number {
  return Math.round(tax * 1.04) // 4% health & education cess
}

export function compareTaxRegimes(inputs: TaxInputs): TaxResult {
  const {
    grossSalary,
    hra,
    section80C,
    section80D,
    npsEmployer80CCD2,
    npsEmployee80CCD1B,
    homeLoanInterest,
    otherDeductions,
  } = inputs

  // Old regime deductions
  const oldStandardDeduction = 50000
  const old80C = Math.min(section80C, 150000)
  const old80D = section80D
  const oldNPS1B = Math.min(npsEmployee80CCD1B, 50000)
  const oldHRA = hra
  const oldHomeLoan = Math.min(homeLoanInterest, 200000)
  const oldDeductions = oldStandardDeduction + old80C + old80D + oldNPS1B + oldHRA + oldHomeLoan + npsEmployer80CCD2 + otherDeductions

  const oldTaxableIncome = Math.max(0, grossSalary - oldDeductions)
  const oldRegimeTax = addCess(computeOldRegimeTax(oldTaxableIncome))

  // New regime deductions (very limited)
  const newStandardDeduction = 75000
  // Only employer NPS 80CCD(2) is allowed in new regime
  const newDeductions = newStandardDeduction + npsEmployer80CCD2

  const newTaxableIncome = Math.max(0, grossSalary - newDeductions)
  const newRegimeTax = addCess(computeNewRegimeTax(newTaxableIncome))

  const recommendation = oldRegimeTax <= newRegimeTax ? 'old' : 'new'
  const savings = Math.abs(oldRegimeTax - newRegimeTax)

  return {
    oldRegimeTax,
    newRegimeTax,
    oldTaxableIncome,
    newTaxableIncome,
    oldDeductions,
    newDeductions,
    recommendation,
    savings,
  }
}
