import { z } from 'zod';
import { PaymentRisk } from '../models/Payment.js';

export const AiRiskResponseSchema = z.object({
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  scam_type: z.enum([
    'none',
    'gift_card',
    'authority_impersonation',
    'grandchild_emergency',
    'romance',
    'tech_support',
    'lottery_prize',
    'investment_crypto',
    'other',
  ]),
  reasons: z.array(z.string()).max(3),
  question_for_elder: z.string().min(5),
  family_summary: z.string().min(10),
});

export type AiRiskResponse = z.infer<typeof AiRiskResponseSchema>;

export interface AiEvaluationInput {
  amount: number;
  payeeLabel: string;
  message?: string;
  isNewPayee?: boolean;
  paymentMethod?: string;
  payeeNote?: string;
  voiceTranscript?: string;
  channel?: string;
}

export interface AiEvaluationResult {
  aiResult: {
    risk: PaymentRisk;
    scamType: string;
    reasons: string[];
    questionForElder: string;
    familySummary: string;
    riskScore?: number;
    tactics?: string[];
    explanation?: string;
    source?: string;
  };
  aiFailed: boolean;
}

const SYSTEM_PROMPT = `You are the security advisor for Second Sight, protecting older adults from financial exploitation.
Evaluate the transaction details (payee name, amount, user message) for indications of social engineering, urgency, secrecy, or fraud.

Always respond in strictly valid JSON adhering to the following schema:
{
  "risk": "LOW" | "MEDIUM" | "HIGH",
  "scam_type": "none" | "gift_card" | "authority_impersonation" | "grandchild_emergency" | "romance" | "tech_support" | "lottery_prize" | "investment_crypto" | "other",
  "reasons": ["Max 3 concise bullet points explaining risk indicators"],
  "question_for_elder": "One gentle, non-threatening question to verify intent",
  "family_summary": "Two calm sentences summarizing the payment context for a family approver"
}

Tone Rules:
1. Never use aggressive terms like "fraud", "criminal", or "scam" in question_for_elder.
2. Maintain empathy and dignity at all times.`;

export function getFailSafeResult(): AiEvaluationResult {
  return {
    aiResult: {
      risk: 'MEDIUM',
      scamType: 'other',
      reasons: ['Transaction safety verification is taking longer than usual'],
      questionForElder: 'Did someone ask you to send this money right now?',
      familySummary:
        'Automated AI evaluation timed out or was temporarily unavailable. Paused as a safety precaution for family verification.',
    },
    aiFailed: true,
  };
}

async function callGemini(apiKey: string, prompt: string, signal: AbortSignal): Promise<string> {
  const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash'];
  let lastError: Error | null = null;

  for (const model of models) {
    if (signal.aborted) break;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\nTransaction to evaluate:\n${prompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Gemini API (${model}) error: ${response.status} - ${errorText.substring(0, 100)}`);
        continue;
      }

      const data = (await response.json()) as any;
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        return rawText;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini model fallbacks failed');
}

async function callXAi(apiKey: string, prompt: string, signal: AbortSignal): Promise<string> {
  const url = 'https://api.x.ai/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('xAI response missing message content');
  }
  return rawText;
}

async function callPythonRiskEngine(
  baseUrl: string,
  input: AiEvaluationInput,
  signal: AbortSignal
): Promise<any> {
  const url = `${baseUrl.replace(/\/$/, '')}/score`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      amount: input.amount,
      currency: 'USD',
      payee_name: input.payeeLabel,
      is_new_payee: input.isNewPayee,
      payment_method: input.paymentMethod,
      payee_note: input.payeeNote,
      message_text: input.message,
      voice_transcript: input.voiceTranscript,
      channel: input.channel,
    }),
  });

  if (!response.ok) {
    throw new Error(`Python risk engine responded with status ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

export async function evaluateAiScam(input: AiEvaluationInput): Promise<AiEvaluationResult> {
  const riskEngineUrl = process.env.RISK_ENGINE_URL || 'http://localhost:8001';

  // 1. Primary path: Call the Python Risk Engine service with 15s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const pyData = await callPythonRiskEngine(riskEngineUrl, input, controller.signal);
    clearTimeout(timeoutId);

    const riskLevelStr = (pyData.risk_level || pyData.risk || 'medium').toLowerCase();
    const riskLevel: PaymentRisk =
      riskLevelStr === 'high' ? 'HIGH' : riskLevelStr === 'medium' ? 'MEDIUM' : 'LOW';

    const reasons: string[] =
      Array.isArray(pyData.tactics) && pyData.tactics.length > 0
        ? pyData.tactics
        : pyData.explanation
        ? [pyData.explanation]
        : ['Automated risk assessment performed'];

    return {
      aiResult: {
        risk: riskLevel,
        scamType: (pyData.tactics && pyData.tactics[0]) || pyData.scamType || 'other',
        reasons,
        questionForElder: pyData.calm_question || pyData.questionForElder || '',
        familySummary: pyData.family_summary || pyData.familySummary || '',
        riskScore: typeof pyData.risk_score === 'number' ? pyData.risk_score : undefined,
        tactics: Array.isArray(pyData.tactics) ? pyData.tactics : [],
        explanation: pyData.explanation || '',
        source: pyData.source || 'fallback',
      },
      aiFailed: pyData.source === 'fallback',
    };
  } catch (pyErr: any) {
    console.warn(
      `[AI] Python risk engine at ${riskEngineUrl} unavailable or timed out: ${
        pyErr?.message || pyErr
      }. Proceeding to fallback.`
    );
  }

  // 2. Secondary path: Direct LLM or fail-safe default if Python service is down
  const geminiKey = process.env.GEMINI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;

  const prompt = JSON.stringify({
    amount: input.amount,
    payee: input.payeeLabel,
    message: input.message || '',
  });

  // 6500ms timeout for LLM call with multi-model fallback
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6500);

  try {
    let rawText: string | null = null;

    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      rawText = await callGemini(geminiKey, prompt, controller.signal);
    } else if (xaiKey && xaiKey !== 'your_xai_api_key_here') {
      rawText = await callXAi(xaiKey, prompt, controller.signal);
    } else {
      console.warn('[AI] No direct GEMINI_API_KEY or XAI_API_KEY found. Activating fail-safe default.');
      return getFailSafeResult();
    }

    clearTimeout(timeoutId);

    const cleanJson = rawText.replace(/```(?:json)?\n?/g, '').trim();
    const parsedJson = JSON.parse(cleanJson);
    const validated = AiRiskResponseSchema.parse(parsedJson);

    return {
      aiResult: {
        risk: validated.risk,
        scamType: validated.scam_type,
        reasons: validated.reasons,
        questionForElder: validated.question_for_elder,
        familySummary: validated.family_summary,
      },
      aiFailed: false,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[AI] Direct LLM scam evaluation failed:', error?.message || error);
    return getFailSafeResult();
  }
}

