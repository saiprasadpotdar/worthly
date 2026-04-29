/**
 * Children's Education Planning Calculator (4.3)
 *
 * Given current annual fees, child's age, target admission age,
 * and education inflation rate, compute the future cost
 * and required monthly SIP to accumulate the corpus.
 */

export interface EducationPlanParams {
  currentAnnualFees: number      // today's annual fees for the target program
  yearsOfStudy: number           // e.g. 4 for BTech, 2 for MBA
  childCurrentAge: number
  targetAdmissionAge: number     // e.g. 18 for undergrad
  educationInflation: number     // e.g. 0.10 (10%)
  expectedReturn: number         // SIP investment return, e.g. 0.12
  currentCorpus: number          // already saved towards this goal
}

export interface EducationPlanResult {
  yearsToGo: number
  futureTotalCost: number        // inflation-adjusted total cost
  futureAnnualCost: number       // per-year cost at admission
  requiredCorpus: number         // present value of the future cost stream
  gap: number                    // requiredCorpus - currentCorpus
  requiredMonthlySIP: number     // to fill the gap
}

export function calculateEducationPlan(params: EducationPlanParams): EducationPlanResult {
  const {
    currentAnnualFees,
    yearsOfStudy,
    childCurrentAge,
    targetAdmissionAge,
    educationInflation,
    expectedReturn,
    currentCorpus,
  } = params

  const yearsToGo = Math.max(0, targetAdmissionAge - childCurrentAge)

  // Future annual cost at admission year
  const futureAnnualCost = currentAnnualFees * Math.pow(1 + educationInflation, yearsToGo)

  // Total cost across all years of study, each year inflating further
  let futureTotalCost = 0
  for (let y = 0; y < yearsOfStudy; y++) {
    futureTotalCost += currentAnnualFees * Math.pow(1 + educationInflation, yearsToGo + y)
  }

  // Discount total future cost back to today to get required corpus at admission time
  // We need the full amount available at admission, so requiredCorpus = futureTotalCost
  // discounted by investment return over the study period is wrong — we need it all upfront.
  // Actually we can invest it during the study too, but simplest model: need full amount at admission.
  const requiredCorpus = Math.round(futureTotalCost)

  // What current corpus will grow to
  const futureCorpus = currentCorpus * Math.pow(1 + expectedReturn, yearsToGo)
  const gap = Math.max(0, requiredCorpus - futureCorpus)

  // Required monthly SIP to fill the gap
  let requiredMonthlySIP = 0
  if (gap > 0 && yearsToGo > 0) {
    const monthlyReturn = expectedReturn / 12
    const months = yearsToGo * 12
    // FV of annuity: gap = SIP * ((1+r)^n - 1) / r
    // SIP = gap * r / ((1+r)^n - 1)
    const growthFactor = Math.pow(1 + monthlyReturn, months) - 1
    requiredMonthlySIP = growthFactor > 0 ? (gap * monthlyReturn) / growthFactor : gap / months
  }

  return {
    yearsToGo,
    futureTotalCost: Math.round(futureTotalCost),
    futureAnnualCost: Math.round(futureAnnualCost),
    requiredCorpus,
    gap: Math.round(gap),
    requiredMonthlySIP: Math.ceil(requiredMonthlySIP / 100) * 100, // round up to nearest 100
  }
}
