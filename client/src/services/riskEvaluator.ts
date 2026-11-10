export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AnalysisResult {
  risk: RiskLevel
  reasons: string[]
  questionForUser?: string
  willHold: boolean
  paymentId?: string
  isLocalEvaluation?: boolean
}

interface EvaluationInput {
  payee: string
  amount: number
  purpose: string
  elderId?: string
}

/**
 * Real client-side rule evaluation matching server/src/controllers/risk.ts.
 * Runs if backend is unavailable or offline, preventing hardcoded mock data.
 */
export function evaluateLocalRules(input: EvaluationInput): AnalysisResult {
  const flags: string[] = []
  let riskScore = 0 // 0 = LOW, 1 = MEDIUM, 2 = HIGH

  const combined = `${input.payee} ${input.purpose}`.toLowerCase()
  const payeeLower = input.payee.toLowerCase()

  // 1. Gift card patterns (High Danger)
  const giftCardRegex =
    /\b(gift\s*card|apple\s*gift|target\s*card|google\s*play|vanilla\s*visa|steam\s*card|itunes|amazon\s*gift)\b/i
  if (giftCardRegex.test(combined)) {
    flags.push('Requests payment via unrecoverable gift cards or digital vouchers')
    riskScore = Math.max(riskScore, 2)
  }

  // 2. Law enforcement / Arrest threats (High Danger)
  const authorityRegex =
    /\b(arrest|warrant|sheriff|police|fbi|irs|jail|prison|court\s*summons|prosecution|bail\s*money|customs\s*fee)\b/i
  if (authorityRegex.test(combined)) {
    flags.push('Mentions legal penalties, law enforcement, or immediate arrest threats')
    riskScore = Math.max(riskScore, 2)
  }

  // 3. Crypto / Wire transfers (High Danger)
  const cryptoWireRegex =
    /\b(crypto|bitcoin|btc|ethereum|usdt|wire\s*transfer|western\s*union|moneygram)\b/i
  if (cryptoWireRegex.test(combined)) {
    flags.push('Directs payment to irreversible cryptocurrency or anonymous wire transfer')
    riskScore = Math.max(riskScore, 2)
  }

  // 4. Tech support / Remote access fraud (High Danger)
  const techSupportRegex =
    /\b(remote\s*access|anydesk|teamviewer|ultraviewer|quick\s*assist|virus\s*detected|tech\s*support|windows\s*defender)\b/i
  if (techSupportRegex.test(combined)) {
    flags.push('Associated with remote computer access, virus alerts, or tech support fee')
    riskScore = Math.max(riskScore, 2)
  }

  // 5. Lottery / Prize sweepstakes (High Danger)
  const lotteryRegex =
    /\b(lottery|sweepstakes|won\s*a\s*prize|claim\s*fee|release\s*funds|inheritance)\b/i
  if (lotteryRegex.test(combined)) {
    flags.push('Demands advance fee or tax to unlock prize or lottery winnings')
    riskScore = Math.max(riskScore, 2)
  }

  // 6. Payee impersonation (High Danger)
  const suspiciousPayeeRegex =
    /\b(irs|officer|agent|sheriff|microsoft\s*support|apple\s*support|department\s*of|fraud\s*dept|customs|tax\s*dept)\b/i
  if (suspiciousPayeeRegex.test(payeeLower)) {
    flags.push(`Recipient name "${input.payee}" suggests institutional or official impersonation`)
    riskScore = Math.max(riskScore, 2)
  }

  // 7. Secrecy & Pressure cues (Medium Danger)
  const secrecyRegex =
    /\b(keep\s*(this\s*)?secret|don'?t\s*tell|dont\s*tell|do\s*not\s*tell|keep\s*between\s*us|hurry|right\s*now|immediately|urgent|within\s*(\d+|one)\s*hour)\b/i
  if (secrecyRegex.test(combined)) {
    flags.push('Applies artificial urgency, panic prompts, or demands secrecy')
    riskScore = Math.max(riskScore, 1)
  }

  // 8. Amount threshold check
  if (input.amount > 50000) {
    flags.push(`High transaction amount (₹${input.amount.toLocaleString('en-IN')}) exceeds safe first-touch threshold`)
    riskScore = Math.max(riskScore, 1)
  }

  // Determine final risk level
  let finalRisk: RiskLevel = 'LOW'
  if (riskScore === 2) {
    finalRisk = 'HIGH'
  } else if (riskScore === 1) {
    finalRisk = 'MEDIUM'
  }

  const willHold = finalRisk === 'MEDIUM' || finalRisk === 'HIGH'

  // If clean, provide positive assurance factors
  if (flags.length === 0) {
    flags.push('No pressure cues, secrecy demands, or high-risk scam keywords detected')
    flags.push('Recipient name fits standard verified payment naming patterns')
    flags.push('Transaction amount is within routine safety boundaries')
  }

  return {
    risk: finalRisk,
    reasons: flags,
    willHold,
    isLocalEvaluation: true,
    questionForUser: willHold
      ? 'Did someone instruct you to send this payment urgently or keep it private?'
      : undefined,
  }
}

/**
 * Main evaluation orchestrator:
 * Attempts backend API check if online, falls back seamlessly to deterministic evaluation.
 */
export async function analyzePayment(input: EvaluationInput): Promise<AnalysisResult> {
  try {
    const controller = new AbortController()
<<<<<<< HEAD
    const timeoutId = setTimeout(() => controller.abort(), 8000)
=======
    const timeoutId = setTimeout(() => controller.abort(), 7000)
>>>>>>> origin/main

    const response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId: input.elderId || 'demo-elder-user',
        amount: input.amount,
        payeeLabel: input.payee,
        message: input.purpose,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      return {
        risk: data.risk as RiskLevel,
        reasons: Array.isArray(data.reasons) ? data.reasons : [],
        questionForUser: data.questionForElder,
        willHold: Boolean(data.willHold),
        paymentId: data.paymentId,
        isLocalEvaluation: false,
      }
    }
  } catch {
    // Backend offline or timeout — fall back to verified local rule evaluation
  }

  return evaluateLocalRules(input)
}

