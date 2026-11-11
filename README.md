# SecondSight

> **"Pause the payment. Not the person."**  
> An AI-powered payment safety cushion built on PayPal Orders v2 that pauses high-pressure elder scams at authorization before money moves, giving families a calm second look. Built for the **PayPal AI Hackathon** (*"Build What's Next with PayPal and AI"*).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PayPal Orders v2](https://img.shields.io/badge/PayPal-Orders_v2_Sandbox-003087?logo=paypal)](https://developer.paypal.com)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](client/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](server/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-Risk_Engine-009688?logo=fastapi)](services/risk-engine/main.py)

---

## The Problem

Older adults lose billions of dollars each year to targeted scams—fake police or IRS warrants, tech support remote-access traps, romance isolation, and "grandchild in jail" emergencies. Scammers rely on two weapons: **artificial urgency** and **secrecy**. Traditional payment flows settle money immediately with zero pause, while harsh *"FRAUD BLOCKED"* popups embarrass seniors and push them away.

## The Solution

SecondSight inserts a calm, reversible pause at the PayPal checkout layer:

1. **Dignity-First Checkout + Voice Input:** The elder enters who they are paying, the amount, and why—either by typing or speaking naturally via the browser **Web Speech API** (*"Speak instead"*).
2. **Dual-Layer Risk Check:** Before PayPal opens, `/api/check` evaluates the payment using deterministic rules and generative AI (**xAI Grok** + **Google Gemini** fallback) while avoiding false alarms on routine bills or birthday gifts.
3. **PayPal `AUTHORIZE` Hold (Zero Money Moved):**
   - **Low Risk:** Authorizes and captures immediately for friction-free everyday spending.
   - **Medium / High Risk:** Creates the PayPal order with `intent: "AUTHORIZE"`. PayPal reserves funds on the buyer's side without transferring money to the recipient. The elder sees a reassuring pause screen (*"We've paused this payment. Your money hasn't moved."*).
4. **Family Co-Sign (`Approve` or `Decline`):** A trusted family member reviews the note, flagged indicators, and plain-English AI summary on the Family Dashboard:
   - **Approve:** Triggers PayPal `CAPTURE` so legitimate large payments proceed cleanly.
   - **Decline or Timeout:** Triggers an immediate PayPal `VOID` (24h default, 2m demo mode), canceling the authorization with zero fees and zero chargebacks.

### How SecondSight Differs From a Simple AI Chatbot

- **AI Advises, Code Decides:** The LLM never touches money or calls PayPal endpoints. Deterministic backend code controls every order creation, authorization, capture, and void.
- **Real PayPal Hold State:** Instead of showing an ignorable chat warning, SecondSight freezes the actual PayPal authorization until a second trusted person decides.
- **Fail-Closed Validation:** AI responses are strictly schema-checked via **Zod** (Node) and **Pydantic** (Python). If an AI call times out or returns invalid JSON, the server flags `aiFailed = true` and defaults to a `MEDIUM` hold.
- **Coercion Protection (`holdToken` Isolation):** The elder's browser never receives the `holdToken` or approval routes, so a scammer coaching an elder over the phone cannot force them to self-approve a hold.

---

## PayPal, AI & Sponsor Integrations

### PayPal Developer Platform (Sandbox: `https://api-m.sandbox.paypal.com`)
- **PayPal JavaScript SDK (`intent=authorize`, `currency=USD`):** Renders PayPal Smart Buttons on the elder screen (`client/src/components/PayPalButton.tsx`) so buyer confirmation initializes an authorization rather than an instant capture.
- **PayPal OAuth 2.0 (`POST /v1/oauth2/token`):** Authenticates backend API calls using Sandbox app credentials with cached bearer tokens (`server/src/controllers/paypal.ts`).
- **PayPal Orders v2 API (`POST /v2/checkout/orders`, `GET /v2/checkout/orders/{id}`, `POST /v2/checkout/orders/{id}/authorize`):** Creates orders strictly from server-locked database amounts/payees (`intent: "AUTHORIZE"`), verifies existing order state prior to retries, and authorizes buyer funds.
- **PayPal Payments v2 Authorizations API (`POST /v2/payments/authorizations/{id}/capture` & `/void`):** Captures approved holds (accepting only explicit `COMPLETED` statuses) and voids declined or expired holds with persistent `PayPal-Request-Id` UUID idempotency headers.
- **PayPal Webhooks (`POST /api/webhooks`):** Ingests `PAYMENT.AUTHORIZATION.VOIDED` and `PAYMENT.CAPTURE.COMPLETED` events (`server/src/controllers/webhooks.ts`).

### AI Models & Services
- **xAI Grok (`grok-2-latest` via Python FastAPI):** Evaluates transaction context across 13 social-engineering tactics (`services/risk-engine/engine.py`), validates outputs via Pydantic v2, filters harsh words (`scam`, `fraud`, `blocked`, `danger`) with a `FORBIDDEN_WORDS` guard, and generates a gentle verification question for the elder plus a plain-English family summary.
- **Google Gemini (`gemini-3-flash-preview` with `gemini-3.5-flash-lite` / `gemini-3.1-flash-lite-preview` / `gemini-3.6-flash` fallbacks):** Direct Node.js LLM fallback/escalation validated with Zod (`server/src/controllers/ai.ts`) so checks stay fast even during Python container cold starts.
- **Browser Web Speech API (`SpeechRecognition`):** Powers hands-free voice dictation (*"Speak instead"*) in `client/src/components/VoiceCapture.tsx`.

### Hosting & API Tooling
- **Render:** Dual-service production blueprint (`render.yaml`) running the Node/Express web app (serving the built React client) and the Python FastAPI risk engine, supported by `/health` checks and lazy hold expiry for free-tier sleep resilience.
- **Postman:** Used during backend development to test and verify the `/api/check`, `/api/orders`, and `/api/holds` endpoints against [openapi.yaml](openapi.yaml).

---

## Architecture & Payment Lifecycle

```text
ELDER VIEW (React + Web Speech API)          FAMILY DASHBOARD (React)
Payment form + PayPal Smart Buttons          Pending holds + Approve / Decline
                |                                         |
                +--------------------+--------------------+
                                     |
                                     v
                EXPRESS API SERVER (server/src/)
                ├── routes/check.ts         (Server-locks amount & payee)
                ├── routes/orders.ts        (Atomic locks & 60s lease recovery)
                ├── controllers/risk.ts     (Deterministic limits & scam rules)
                ├── controllers/ai.ts       (Python engine + Gemini/xAI + Zod)
                ├── controllers/paypal.ts   (Authorize, Capture, Void + Idempotency)
                └── controllers/holds.ts    (Family decisions & lazy expiry)
                      |                   |                   |
                      v                   v                   v
            Python Risk Engine      PayPal Sandbox      MongoDB Atlas
            (FastAPI + Grok)        (Orders v2 API)     (Atomic state locks)
```

### Payment State Machine

```text
CHECKED ──> CREATED ──> AUTHORIZED ──┬──> PROCESSING ──> CAPTURED  (Low Risk: Instant)
                                     │
                                     └──> HELD ──> PROCESSING ──┬──> CAPTURED  (Family Approved)
                                                                 └──> VOIDED    (Declined / Expired)
```

For detailed specs, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md), [docs/AI_EVAL.md](docs/AI_EVAL.md), and [openapi.yaml](openapi.yaml).

---

## Tech Stack

- **Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS v4, Custom Accessible SVGs (`Icons.tsx`), Browser Web Speech API, `Newsreader` & `Atkinson Hyperlegible Next` typography (`20px+` inputs, `48px–52px` touch targets).
- **Backend:** Node.js, Express, TypeScript, Mongoose, Zod.
- **Risk Microservice:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, OpenAI SDK (xAI Grok), HTTPX.
- **Database:** MongoDB Atlas.
- **Payments:** PayPal JavaScript SDK + PayPal Orders v2 & Authorizations v2 REST API (Sandbox).
- **Deployment & Testing:** Render (`render.yaml`), Postman, Pytest, `tsx`.

---

## Getting Started (Local Development)

### 1. Prerequisites

- Node.js `v18+` and npm
- Python `3.11+`
- A [PayPal Developer](https://developer.paypal.com) account with **US Business** and **US Personal** Sandbox accounts
- A [MongoDB Atlas](https://www.mongodb.com/atlas) connection string

### 2. Clone & Install Dependencies

```bash
git clone https://github.com/siddhigupta075/obsidian.git
cd obsidian

# Install frontend and backend dependencies
npm --prefix client install
npm --prefix server install

# Install Python risk engine dependencies
pip install -r services/risk-engine/requirements.txt
```

### 3. Environment Configuration

Copy [.env.example](.env.example) to `.env` in the repository root:

```bash
cp .env.example .env
```

Fill in your keys:

```env
PORT=3000
NODE_ENV=development
PAYPAL_CLIENT_ID=your_us_business_sandbox_client_id
PAYPAL_SECRET=your_us_business_sandbox_secret
PAYPAL_BASE=https://api-m.sandbox.paypal.com
MONGODB_URI=your_mongodb_atlas_connection_string
RISK_ENGINE_URL=http://localhost:8001
XAI_API_KEY=your_xai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
HOLD_MINUTES=2 # Use 2 for fast demo testing; 1440 (24h) for standard mode
```

### 4. Start the Services

**Terminal 1 — Python Risk Engine (`http://localhost:8001`):**
```bash
npm run risk:start
```

**Terminal 2 — Express Backend (`http://localhost:3000`):**
```bash
npm --prefix server run dev
```

**Terminal 3 — Vite Frontend (`http://localhost:5173`, proxies `/api` to `:3000`):**
```bash
npm --prefix client run dev
```

Or run the production build from a single Node process on `http://localhost:3000`:
```bash
npm run build
npm start
```

---

## Judge Testing Guide (Side-by-Side Live Demo)

1. Open the app in **two browser windows side by side**:
   - **Left Window (Elder):** Keep the default **Elder** view (`Margaret Davis`).
   - **Right Window (Family):** Click **Family** in the bottom-right `DEMO` switcher (or append `?role=family`).
2. **Scenario 1 — Normal Payment (Instant Capture):**
   - Payee: `Plumber` | Amount: `80` | Purpose: `Repair kitchen sink pipe`
   - Evaluated as `LOW` risk → complete the PayPal Sandbox popup → captured immediately.
3. **Scenario 2 — Coercive Scam (Authorize Hold → Family Void):**
   - Payee: `Officer Mike` | Amount: `500` | Purpose: `Send gift cards immediately or police warrant will be issued` (or dictate using **Speak instead**)
   - Evaluated as `HIGH` risk → complete the PayPal Sandbox popup → Elder window displays a calm hold (*"We've paused this payment. Your money hasn't moved."*).
   - On the Family Dashboard (right window), review the AI summary and click **Decline payment** → PayPal authorization is immediately voided and both screens update live.

### PayPal Sandbox Buyer Account (For Checkout Popup)
- **Email:** `sb-yskuw53855590@personal.example.com`
- **Password:** *(Provided in the Devpost submission form)*

> **Note on Render Free Tier:** Free Render web services spin down after 15 minutes of inactivity, so the initial request may take ~50 seconds to wake up.

---

## Testing & AI Benchmarks

```bash
# 1. Offline Python risk-engine unit & HTTP tests
npm run risk:test

# 2. Offline deterministic fallback benchmark (30 curated scam & trap cases)
python3 services/risk-engine/evaluate.py --fallback-only

# 3. Live LLM benchmark across 30 cases (requires GEMINI_API_KEY or XAI_API_KEY)
npm run test:ai

# 4. PayPal lifecycle, concurrency lock & idempotency suite (requires MONGODB_URI)
npm run test:lifecycle
```

### Benchmark Summary (`services/risk-engine/tests/results.json`)
Evaluated offline in deterministic fallback mode across 30 cases (`services/risk-engine/tests/scam_test_dataset.json`: 17 scams + 13 legitimate transactions including birthday gift-card and routine utility-deadline traps):
- **Scam Recall (Catch Rate):** `100.0%` (`17/17` caught, `0` missed)
- **Precision:** `94.4%` (`1` intentional hold on `N13`, a `$6,500` deposit to a new roofing contractor)
- **F1 Score:** `0.9714` (`1.0000` treating `N13` co-sign hold as expected)
- **Exact Risk-Level Match:** `90.0%` (`27/30`)

Also includes 10 lifecycle, lease-recovery, and concurrency-safety test scenarios in [server/test/lifecycle-test.ts](server/test/lifecycle-test.ts). Detailed rubric and dataset notes are in [docs/AI_EVAL.md](docs/AI_EVAL.md).

---

## What's Next

- **Live SMS / Push Notifications:** Enable Twilio SMS alerts using the existing [server/src/services/notify.ts](server/src/services/notify.ts) integration alongside Web Push.
- **Trusted Payee Learning:** Adaptively whitelist recurring legitimate utilities, doctors, and family members while keeping heightened checks on new recipients.
- **Production Auth & Webhook Verification:** Add passkey/OAuth family authentication and PayPal webhook cryptographic signature verification.
- **Multilingual Voice Dictation:** Expand Web Speech API locale support beyond `en-IN` for non-English-speaking seniors.

---

## License

Licensed under the [MIT License](LICENSE).
