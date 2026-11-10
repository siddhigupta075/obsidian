import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { evaluateRules } from '../src/controllers/risk.js';
import { evaluateAiScam } from '../src/controllers/ai.js';
import { PaymentRisk } from '../src/models/Payment.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

interface TestCase {
  id: string;
  type: 'scam' | 'legitimate';
  scamType: string;
  amount: number;
  payee: string;
  message: string;
  expectedRisk: PaymentRisk[];
}

function maxRisk(r1: PaymentRisk, r2: PaymentRisk): PaymentRisk {
  const scores: Record<PaymentRisk, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return scores[r1] >= scores[r2] ? r1 : r2;
}

async function runEvaluation() {
  console.log('================================================================');
  console.log('🧪 Second Sight — AI Scam Detection Benchmark Test Runner');
  console.log('================================================================\n');

  const datasetPath = path.resolve(process.cwd(), 'test/ai-eval.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found at ${datasetPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(datasetPath, 'utf-8');
  const testCases: TestCase[] = JSON.parse(raw);

  let totalScams = 0;
  let caughtScams = 0;
  let totalLegit = 0;
  let falseAlarms = 0;
  let totalLatency = 0;

  for (const tc of testCases) {
    const start = performance.now();

    const rulesResult = evaluateRules({
      amount: tc.amount,
      payeeLabel: tc.payee,
      message: tc.message,
      amountLimit: 100,
    });

    const { aiResult } = await evaluateAiScam({
      amount: tc.amount,
      payeeLabel: tc.payee,
      message: tc.message,
    });

    const duration = performance.now() - start;
    totalLatency += duration;

    const finalRisk = maxRisk(rulesResult.risk, aiResult.risk);
    const passed = tc.expectedRisk.includes(finalRisk);

    if (tc.type === 'scam') {
      totalScams++;
      if (finalRisk === 'MEDIUM' || finalRisk === 'HIGH') {
        caughtScams++;
      }
    } else {
      totalLegit++;
      if (finalRisk === 'MEDIUM' || finalRisk === 'HIGH') {
        falseAlarms++;
      }
    }

    const badge = passed ? '✅ PASS' : '❌ FAIL';
    console.log(
      `${badge} [${tc.id}] (${tc.type.toUpperCase()}) Payee: "${tc.payee}" | Amount: $${tc.amount}`
    );
    console.log(
      `   Outcome: ${finalRisk} | Expected: ${tc.expectedRisk.join('/')} | Latency: ${duration.toFixed(0)}ms`
    );
    if (!passed) {
      console.log(`   Reasons: ${rulesResult.flags.concat(aiResult.reasons).join('; ')}`);
    }

    // Pacing to stay within Gemini free tier 15 RPM
    await new Promise((r) => setTimeout(r, 2200));
  }

  const catchRate = (caughtScams / totalScams) * 100;
  const falseAlarmRate = (falseAlarms / totalLegit) * 100;
  const avgLatency = (totalLatency / testCases.length) / 1000;

  console.log('\n================================================================');
  console.log('📊 BENCHMARK METRIC SUMMARY');
  console.log('================================================================');
  console.log(`Catch Rate (Recall):       ${catchRate.toFixed(1)}% (Target: >= 90.0%)`);
  console.log(`False Alarm Rate:          ${falseAlarmRate.toFixed(1)}% (Target: <= 15.0%)`);
  console.log(`Avg Response Latency:      ${avgLatency.toFixed(2)}s (Target: <= 2.50s)`);
  console.log('================================================================\n');

  if (catchRate >= 90 && falseAlarmRate <= 15) {
    console.log('🎉 Benchmark PASSED: All safety targets met.');
  } else {
    console.log('⚠️ Benchmark WARNING: One or more targets outside threshold.');
  }
}

runEvaluation();

