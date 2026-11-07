# AGENTS.md — Working Rules for AI Agents

Welcome to **Second Sight**. This file contains non-negotiable rules and architectural constraints for any AI agent or assistant writing code in this repository.

---

## 1. Non-Negotiable Hard Rules

1. **Server sets amount and payee:** The server stores amount and payee label from `/api/check`. Subsequent calls (`/api/orders`, `/authorize`) must strictly use stored database values. Never trust the client payload for financial numbers after check time.
2. **AI advises, code decides:** The AI model analyzes context and returns a risk score. It never captures or voids money directly. Backend business logic controls the execution flow.
3. **Fail-safe default:** If an AI API call fails, times out, or returns malformed JSON, mark `aiFailed = true` and **hold the payment** (risk: `MEDIUM` or `HIGH`). Never fail open.
4. **PayPal intent is AUTHORIZE:** Both the PayPal JavaScript SDK script tag/config (`intent: "authorize"`) and the server-side order creation payload (`intent: "AUTHORIZE"`) must specify `AUTHORIZE`. Never set `CAPTURE`.
5. **Atomic status transitions:** Prevent race conditions and double capture/void by atomically transitioning from `HELD` to `PROCESSING` (e.g., `findOneAndUpdate({ _id, status: 'HELD' }, { status: 'PROCESSING' })`). If no document matches, abort immediately.
6. **Idempotency headers:** Always attach a unique `PayPal-Request-Id` UUID header on capture and void requests.
7. **Protect the elder's screen:** Never send `holdToken` or the decision link to the elder's client. Family members access holds exclusively via their authenticated view or secure pending hold token.
8. **Sandbox only:** Never use or request live production PayPal credentials. Use sandbox endpoints (`https://api-m.sandbox.paypal.com`).
9. **Zero secrets in source control:** Secrets belong in `.env`. Keep `.env.example` updated with mock placeholders.
10. **Validate AI responses:** Parse and validate all LLM responses strictly using **Zod**.
11. **Free-tier constraints:** Designed for Render free tier and MongoDB Atlas M0. Ephemeral filesystem (no writing to local disk). No paid cron jobs (use lazy check on requests + backup `setInterval`).
12. **Ask before adding dependencies:** Do not install new packages without explicit team consent.

---

## 2. Communication Style

- Explain decisions in simple, direct English.
- Avoid technical jargon without a one-line plain language definition.
- When something in the architecture seems risky or broken, state it clearly and provide reasons. Do not silently work around architectural decisions.

---

## 3. Project Directory Map

- `client/`: React + Vite + TypeScript + Tailwind CSS frontend.
  - `src/pages/`: `ElderPaymentView.tsx`, `PausedView.tsx`, `FamilyDashboard.tsx`, `FamilyApprove.tsx`.
  - `src/components/`: Reusable components (e.g., `TransactionGrid.tsx`, `HoldTimeline.tsx`, `VoiceCapture.tsx`).
- `server/`: Express + TypeScript backend.
  - `src/routes/`: REST endpoints for check, orders, holds, payments, demo, health.
  - `src/services/` or `src/controllers/`: `paypal.ts`, `ai.ts`, `risk.ts`, `holds.ts`.
  - `src/models/`: Mongoose schemas for `User`, `FamilyLink`, and `Payment`.
  - `test/`: AI benchmark dataset (`ai-eval.json`) and test runner (`run-eval.ts`).
- `docs/`: Technical specifications, architecture designs, API contracts, evaluation rubrics.
