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
      source: 'fallback',
    },
    aiFailed: true,
  };
}

async function callGemini(apiKey: string, prompt: string, signal: AbortSignal): Promise<string> {
  const models = [
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.6-flash',
  ];
  const PER_MODEL_TIMEOUT_MS = 4000;
  let lastError: Error | null = null;

  for (const model of models) {
    if (signal.aborted) break;

    const attemptController = new AbortController();
    const onParentAbort = () => attemptController.abort();
    signal.addEventListener('abort', onParentAbort, { once: true });
    const attemptTimer = setTimeout(() => attemptController.abort(), PER_MODEL_TIMEOUT_MS);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const generationConfig: Record<string, any> = {
        responseMimeType: 'application/json',
        temperature: 0.1,
      };
      if (model.startsWith('gemini-3')) {
        generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: attemptController.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\nTransaction to evaluate:\n${prompt}` }],
            },
          ],
          generationConfig,
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
      lastError = new Error(`Gemini API (${model}) returned empty content`);
    } catch (err: any) {
      if (signal.aborted) throw err;
      lastError =
        err?.name === 'AbortError'
          ? new Error(`Gemini API (${model}) timed out after ${PER_MODEL_TIMEOUT_MS}ms`)
          : err;
    } finally {
      clearTimeout(attemptTimer);
      signal.removeEventListener('abort', onParentAbort);
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
      model: process.env.XAI_MODEL || 'grok-2-latest',
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

const PythonRiskEngineSchema = z
  .object({
    risk_level: z.string().optional(),
    risk: z.string().optional(),
    tactics: z.array(z.string()).optional(),
    explanation: z.string().optional(),
    scamType: z.string().optional(),
    calm_question: z.string().optional(),
    questionForElder: z.string().optional(),
    family_summary: z.string().optional(),
    familySummary: z.string().optional(),
    risk_score: z.number().optional(),
    source: z.string().optional(),
  })
  .refine((data) => Boolean(data.risk_level || data.risk), {
    message: 'Python risk engine response missing risk_level/risk',
  });

export async function evaluateAiScam(input: AiEvaluationInput): Promise<AiEvaluationResult> {
  const riskEngineUrl = process.env.RISK_ENGINE_URL?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const xaiKey = process.env.XAI_API_KEY?.trim();

  const hasGeminiKey = Boolean(geminiKey && geminiKey !== 'your_gemini_api_key_here');
  const hasXaiKey = Boolean(xaiKey && xaiKey !== 'your_xai_api_key_here');
  const hasDirectLlmKey = hasGeminiKey || hasXaiKey;

  // 1. Primary path: Call the Python Risk Engine only when RISK_ENGINE_URL is configured.
  // Keep timeout short when a direct LLM key is available so sleeping free-tier cold starts
  // do not exhaust the client timeout budget before Gemini/xAI runs.
  if (riskEngineUrl) {
    const pyTimeoutMs = hasDirectLlmKey ? 4000 : 9000;
    const pyController = new AbortController();
    const pyTimeoutId = setTimeout(() => pyController.abort(), pyTimeoutMs);

    try {
      const rawPyData = await callPythonRiskEngine(riskEngineUrl, input, pyController.signal);
      clearTimeout(pyTimeoutId);

      const pyData = PythonRiskEngineSchema.parse(rawPyData);
      const source = pyData.source || 'fallback';
      const isFallbackSource = source === 'fallback';

      if (isFallbackSource && hasDirectLlmKey) {
        console.warn(
          '[AI] Python risk engine returned rule-based fallback; escalating to direct Node LLM evaluation.'
        );
      } else {
        const riskLevelStr = (pyData.risk_level || pyData.risk || 'medium').toLowerCase();
        let riskLevel: PaymentRisk =
          riskLevelStr === 'high' ? 'HIGH' : riskLevelStr === 'medium' ? 'MEDIUM' : 'LOW';

        // Hard Rule #3: Fail-safe default — never fail open with LOW risk if AI fell back to rules
        if (isFallbackSource && riskLevel === 'LOW') {
          riskLevel = 'MEDIUM';
        }

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
            questionForElder:
              pyData.calm_question ||
              pyData.questionForElder ||
              'Did someone ask you to send this money right now?',
            familySummary: pyData.family_summary || pyData.familySummary || '',
            riskScore: typeof pyData.risk_score === 'number' ? pyData.risk_score : undefined,
            tactics: Array.isArray(pyData.tactics) ? pyData.tactics : [],
            explanation: pyData.explanation || '',
            source,
          },
          aiFailed: isFallbackSource,
        };
      }
    } catch (pyErr: any) {
      clearTimeout(pyTimeoutId);
      console.warn(
        `[AI] Python risk engine at ${riskEngineUrl} unavailable or timed out: ${
          pyErr?.message || pyErr
        }. Proceeding to fallback.`
      );
    }
  }

  // 2. Secondary path: Direct LLM or fail-safe default
  const prompt = JSON.stringify({
    amount: input.amount,
    payee: input.payeeLabel,
    message: input.message || '',
  });

  // 9500ms timeout for LLM call with multi-model fallback
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9500);

  try {
    let rawText: string | null = null;
    let llmSource = 'fallback';

    if (hasGeminiKey && geminiKey) {
      try {
        rawText = await callGemini(geminiKey, prompt, controller.signal);
        llmSource = 'gemini';
      } catch (geminiErr: any) {
        if (hasXaiKey && xaiKey && !controller.signal.aborted) {
          console.warn(
            '[AI] Direct Gemini failed; falling back to xAI:',
            geminiErr?.message || geminiErr
          );
          rawText = await callXAi(xaiKey, prompt, controller.signal);
          llmSource = 'grok';
        } else {
          throw geminiErr;
        }
      }
    } else if (hasXaiKey && xaiKey) {
      rawText = await callXAi(xaiKey, prompt, controller.signal);
      llmSource = 'grok';
    } else {
      clearTimeout(timeoutId);
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
        source: llmSource,
      },
      aiFailed: false,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[AI] Direct LLM scam evaluation failed:', error?.message || error);
    return getFailSafeResult();
  }
}

