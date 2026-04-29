/**
 * India-Specific Instrument Calculators
 *
 * EPF (Employee Provident Fund), PPF (Public Provident Fund),
 * and NPS (National Pension System) projections.
 */

export interface EPFProjectionParams {
  currentBalance: number
  monthlyBasicPay: number      // basic + DA
  employeeContribRate: number  // typically 0.12 (12%)
  employerContribRate: number  // typically 0.0833 (8.33% to EPF after EPS diversion)
  annualInterestRate: number   // typically 0.0815 (8.15%)
  annualSalaryGrowth: number   // e.g. 0.10
  yearsToProject: number
}

export interface EPFProjectionYear {
  year: number
  balance: number
  employeeContrib: number
  employerContrib: number
  interest: number
}

export function projectEPF(params: EPFProjectionParams): EPFProjectionYear[] {
  const {
    currentBalance,
    monthlyBasicPay,
    employeeContribRate,
    employerContribRate,
    annualInterestRate,
    annualSalaryGrowth,
    yearsToProject,
  } = params

  const currentYear = new Date().getFullYear()
  const projections: EPFProjectionYear[] = []
  let balance = currentBalance
  let basic = monthlyBasicPay

  for (let y = 0; y <= yearsToProject; y++) {
    const annualEmployeeContrib = basic * 12 * employeeContribRate
    const annualEmployerContrib = basic * 12 * employerContribRate
    const totalContrib = annualEmployeeContrib + annualEmployerContrib
    const interest = (balance + totalContrib / 2) * annualInterestRate

    projections.push({
      year: currentYear + y,
      balance: Math.round(balance),
      employeeContrib: Math.round(annualEmployeeContrib),
      employerContrib: Math.round(annualEmployerContrib),
      interest: Math.round(interest),
    })

    balance += totalContrib + interest
    basic *= (1 + annualSalaryGrowth)
  }

  return projections
}

export interface PPFProjectionParams {
  currentBalance: number
  annualContribution: number   // max ₹1.5L
  annualInterestRate: number   // typically 0.071 (7.1%)
  yearsToProject: number
}

export function projectPPF(params: PPFProjectionParams): { year: number; balance: number; contribution: number; interest: number }[] {
  const { currentBalance, annualContribution, annualInterestRate, yearsToProject } = params
  const currentYear = new Date().getFullYear()
  const projections: { year: number; balance: number; contribution: number; interest: number }[] = []
  let balance = currentBalance

  for (let y = 0; y <= yearsToProject; y++) {
    const interest = (balance + annualContribution / 2) * annualInterestRate
    projections.push({
      year: currentYear + y,
      balance: Math.round(balance),
      contribution: Math.round(annualContribution),
      interest: Math.round(interest),
    })
    balance += annualContribution + interest
  }

  return projections
}

export interface NPSProjectionParams {
  currentBalance: number
  monthlyContribution: number
  expectedReturn: number       // typically 0.10 for aggressive, 0.08 for balanced
  annualContribIncrease: number
  yearsToProject: number
}

export function projectNPS(params: NPSProjectionParams): { year: number; balance: number; contribution: number }[] {
  const { currentBalance, monthlyContribution, expectedReturn, annualContribIncrease, yearsToProject } = params
  const currentYear = new Date().getFullYear()
  const projections: { year: number; balance: number; contribution: number }[] = []
  let balance = currentBalance
  let monthly = monthlyContribution
  const monthlyReturn = expectedReturn / 12

  for (let y = 0; y <= yearsToProject; y++) {
    projections.push({
      year: currentYear + y,
      balance: Math.round(balance),
      contribution: Math.round(monthly * 12),
    })

    // Simulate 12 months of SIP + returns
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyReturn) + monthly
    }
    monthly *= (1 + annualContribIncrease)
  }

  return projections
}
