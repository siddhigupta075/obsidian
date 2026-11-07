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
}

export interface AiEvaluationResult {
  aiResult: {
    risk: PaymentRisk;
    scamType: string;
    reasons: string[];
    questionForElder: string;
    familySummary: string;
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini response missing content text');
  }
  return rawText;
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

export async function evaluateAiScam(input: AiEvaluationInput): Promise<AiEvaluationResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;

  const prompt = JSON.stringify({
    amount: input.amount,
    payee: input.payeeLabel,
    message: input.message || '',
  });

  // Strict 4000ms timeout for LLM call as per AI_EVAL.md
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    let rawText: string | null = null;

    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      rawText = await callGemini(geminiKey, prompt, controller.signal);
    } else if (xaiKey && xaiKey !== 'your_xai_api_key_here') {
      rawText = await callXAi(xaiKey, prompt, controller.signal);
    } else {
      // No active AI API key provided. Apply fail-safe default.
      console.warn('[AI] No active GEMINI_API_KEY or XAI_API_KEY found. Activating fail-safe default.');
      return getFailSafeResult();
    }

    clearTimeout(timeoutId);

    // Clean JSON markdown fences if present
    const cleanJson = rawText.replace(/```(?:json)?\n?/g, '').trim();
    const parsedJson = JSON.parse(cleanJson);

    // Strict Zod schema validation
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
    console.error('[AI] Scam evaluation failed or timed out:', error?.message || error);
    // Never fail open - return fail-safe MEDIUM hold
    return getFailSafeResult();
  }
}

