import { PaymentRisk } from '../models/Payment.js';

export interface RuleEvaluationInput {
  amount: number;
  payeeLabel: string;
  message?: string;
  amountLimit?: number;
}

export interface RuleEvaluationResult {
  risk: PaymentRisk;
  flags: string[];
}

export function evaluateRules(input: RuleEvaluationInput): RuleEvaluationResult {
  const flags: string[] = [];
  let riskScore = 0; // 0 = LOW, 1 = MEDIUM, 2 = HIGH

  const limit = input.amountLimit ?? 100;
  const messageText = (input.message || '').toLowerCase();
  const payeeText = (input.payeeLabel || '').toLowerCase();
  const combined = `${payeeText} ${messageText}`;

  // 1. Amount threshold check
  if (input.amount > limit) {
    flags.push(`Amount ($${input.amount.toFixed(2)}) exceeds configured threshold ($${limit.toFixed(2)})`);
    riskScore = Math.max(riskScore, 1);
  }
  if (input.amount >= 500) {
    flags.push(`High payment amount ($${input.amount.toFixed(2)})`);
    riskScore = Math.max(riskScore, 2);
  }

  // 2. Gift card patterns (High Danger)
  const giftCardRegex = /\b(gift\s*card|apple\s*gift|target\s*card|google\s*play|vanilla\s*visa|steam\s*card|itunes)\b/i;
  if (giftCardRegex.test(combined)) {
    flags.push('Requests payment via gift cards');
    riskScore = Math.max(riskScore, 2);
  }

  // 3. Law enforcement / Arrest threats (High Danger)
  const authorityRegex = /\b(arrest|warrant|sheriff|police|fbi|irs|jail|prison|court\s*summons|prosecution|bail\s*money)\b/i;
  if (authorityRegex.test(combined)) {
    flags.push('Threatens law enforcement action or arrest');
    riskScore = Math.max(riskScore, 2);
  }

  // 4. Crypto / Wire transfers (High Danger)
  const cryptoWireRegex = /\b(crypto|bitcoin|btc|ethereum|usdt|wire\s*transfer|western\s*union|moneygram)\b/i;
  if (cryptoWireRegex.test(combined)) {
    flags.push('Requests irreversible wire transfer or cryptocurrency');
    riskScore = Math.max(riskScore, 2);
  }

  // 5. Tech support / Remote access fraud (High Danger)
  const techSupportRegex = /\b(remote\s*access|anydesk|teamviewer|ultraviewer|quick\s*assist|virus\s*detected|tech\s*support)\b/i;
  if (techSupportRegex.test(combined)) {
    flags.push('Requests remote computer access or mentions virus removal');
    riskScore = Math.max(riskScore, 2);
  }

  // 6. Lottery / Prize sweepstakes (High Danger)
  const lotteryRegex = /\b(lottery|sweepstakes|won\s*a\s*prize|claim\s*fee|release\s*funds)\b/i;
  if (lotteryRegex.test(combined)) {
    flags.push('Demands fee to release prize or lottery winnings');
    riskScore = Math.max(riskScore, 2);
  }

  // 7. Secrecy & Pressure cues (Medium Danger)
  const secrecyRegex = /\b(keep\s*(this\s*)?secret|don'?t\s*tell|dont\s*tell|do\s*not\s*tell|keep\s*between\s*us|hurry|right\s*now|immediately|urgent)\b/i;
  if (secrecyRegex.test(combined)) {
    flags.push('Applies artificial urgency or demands secrecy');
    riskScore = Math.max(riskScore, 1);
  }

  // 8. Payee impersonation (High Danger)
  const suspiciousPayeeRegex = /\b(irs|officer|agent|sheriff|microsoft\s*support|apple\s*support|department\s*of|fraud\s*dept)\b/i;
  if (suspiciousPayeeRegex.test(payeeText)) {
    flags.push(`Payee name "${input.payeeLabel}" suggests institutional or official impersonation`);
    riskScore = Math.max(riskScore, 2);
  }

  let finalRisk: PaymentRisk = 'LOW';
  if (riskScore === 2) {
    finalRisk = 'HIGH';
  } else if (riskScore === 1) {
    finalRisk = 'MEDIUM';
  }

  return {
    risk: finalRisk,
    flags,
  };
}

