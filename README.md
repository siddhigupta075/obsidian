# Second Sight

> **"Pause the payment. Not the person."**  
> An intelligent payment protection layer that pauses high-pressure scams before funds move, giving families a calm second look. Built for the PayPal AI Hackathon (*"Build what's next with PayPal and AI"*).

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![PayPal Orders v2](https://img.shields.io/badge/PayPal-Orders_v2_Sandbox-003087?logo=paypal)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)

---

## The Problem

Older adults lose billions of dollars each year to targeted scams—including fake arrest threats, tech support fraud, romantic deceits, and emergency requests from purported grandchildren. These attacks rely on **urgency** and **secrecy**. Traditional payment workflows finalize transactions immediately, leaving families with zero recourse once funds have left the account.

## The Solution

**Second Sight** introduces a safety cushion at the payment layer:

1. **Intelligent Pre-Check:** When an elder initiates a payment, our system runs deterministic rule checks and generative AI analysis on the transaction context.
2. **Authorize, Don't Charge:** If the transaction looks suspicious, Second Sight sets PayPal's order intent to `AUTHORIZE`. Funds are placed on hold in the buyer's account, but **money never moves to the recipient**.
3. **Gentle Pause & Family Review:** Instead of aggressive fraud alarms, the elder receives an empathetic message (*"Paused for a second look"*). A trusted family member reviews the transaction context on their dashboard.
4. **Capture or Void:**
   - **Approve:** The family confirms the payment, executing a PayPal `CAPTURE`.
   - **Decline or Timeout:** The family declines or the hold window expires (24h default, 2 min demo), executing an immediate PayPal `VOID`. The authorization disappears without fees or chargebacks.

---

## Key Features

- **Empathetic Elder UI:** Clean layout, high-contrast text ($\ge 20\text{px}$), accessible copy, and integrated speech-to-text via the browser Web Speech API.
- **Family Review Dashboard:** Real-time visibility into held transactions with plain-English AI explanations of potential scam indicators.
- **Strict Server Authority:** Monetary amounts and recipient details are locked during pre-check; clients cannot modify amounts after risk evaluation.
- **Dual-Layer Risk Engine:** Deterministic rule flags combined with Zod-validated LLM analysis.
- **Graceful Fail-Safe:** If the AI service experiences latency or fails, the transaction automatically defaults to `HELD` to protect the elder.

---

## Architecture & Payment Flow

```
ELDER SCREEN (React)                       FAMILY DASHBOARD (React)
Pay screen + Voice input                   Pending holds list + Decision controls
        |                                             |
        +---------------------+-----------------------+
                              |
                              v
             EXPRESS SERVER (Single Render Service)
             ├── services/risk.ts     (Deterministic regex & limits)
             ├── services/ai.ts       (LLM analysis with Zod validation)
             ├── services/paypal.ts   (Authorize, Capture, Void)
             └── services/holds.ts    (Concurrency lock & lazy expiry)
                   |             |             |
                   v             v             v
             PayPal Sandbox   LLM API    MongoDB Atlas
```

### Payment State Lifecycle

```
CHECKED ──> CREATED ──> AUTHORIZED ──┬──> PROCESSING ──> CAPTURED  (Low Risk: Instant)
                                     │
                                     └──> HELD ──> PROCESSING ──┬──> CAPTURED  (Family Approved)
                                                                 └──> VOIDED    (Declined / Expired)
```

For comprehensive technical specifications, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/API.md](docs/API.md).

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Browser Web Speech API.
- **Backend:** Node.js, Express, TypeScript, Mongoose.
- **Database:** MongoDB Atlas (M0 free cluster).
- **Payment Gateway:** PayPal JavaScript SDK + PayPal Orders v2 REST API (Sandbox).
- **AI Engine:** Generative AI API (Grok / Gemini) validated via Zod.
- **Deployment:** Render Web Service (Free Tier) + external health pinger.

---

## Getting Started (Local Development)

### 1. Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A free [PayPal Developer](https://developer.paypal.com) account (Sandbox)
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) database connection string

### 2. Clone and Install

```bash
git clone https://github.com/your-username/second-sight.git
cd second-sight
npm install
```

### 3. Environment Configuration

Copy [.env.example](.env.example) to `.env`:

```bash
cp .env.example .env
```

Populate the required keys:

```env
PORT=3000
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_SECRET=your_sandbox_secret
PAYPAL_BASE=https://api-m.sandbox.paypal.com
MONGODB_URI=your_mongodb_atlas_connection_string
XAI_API_KEY=your_llm_api_key
HOLD_MINUTES=2 # Set to 2 for quick demo testing; default is 1440 (24h)
```

### 4. Seed Demo Users

Seed the database with a pre-configured elder, family member, and spending link:

```bash
npm run seed
```

### 5. Run the Application

Run both server and client concurrently:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Live Demo & Testing Credentials

For hackathon judges testing the live deployed instance or local environment:

### Side-by-Side Browser Demonstration

1. Open **two browser windows side by side**:
   - **Left Window:** Select the **Elder** role.
   - **Right Window:** Select the **Family** role.
2. **Scenario 1 (Legitimate Payment):**
   - Elder pays **80** to *"Plumber"* with memo: *"Repair kitchen sink pipe"*.
   - **Result:** Assessed as `LOW` risk. Captures immediately.
3. **Scenario 2 (Coercive Scam):**
   - Elder pays **500** to *"Officer Mike"* with memo: *"Send gift cards immediately or police warrant will be issued"*.
   - **Result:** Assessed as `HIGH` risk. Money is held. Left window displays *"Paused for a second look"*.
   - In the right window, the pending hold appears with AI analysis. Click **Decline**.
   - The PayPal authorization is immediately voided; funds never leave the account.

### Sandbox Credentials for Judges

- **Elder Sandbox Personal Account:**
  - Email: `sb-elder-buyer@personal.example.com` *(placeholder: add your sandbox buyer email)*
  - Password: `[Provided in submission form]`
- **Receiver Sandbox Business Account:**
  - Automated sandbox merchant receiver configured on backend.

> **Note on Render Free Tier:** Render spins down free web services after 15 minutes of inactivity. Initial page load may require ~50 seconds for cold container spin-up.

---

## Evaluation & Benchmarks

The AI detection engine is evaluated against a 30-case labeled benchmark dataset (`server/test/ai-eval.json`):

```bash
npm run test:ai
```

- **Catch Rate (Scam Recall):** Target $\ge 90$
- **False Alarm Rate:** Target $\le 15$

Detailed prompt design and benchmark results are documented in [docs/AI_EVAL.md](docs/AI_EVAL.md).

---

## Project Roadmap & Future Enhancements

- **Direct Push / SMS Alerts:** Real-time notifications to family members via Twilio or Web Push.
- **B2B Scam-Risk API:** Exposing the pre-check engine to partner credit unions and banks via APIMatic-generated SDKs.
- **Multilingual Voice Support:** Expanding Web Speech synthesis and recognition to support multiple languages for non-English speaking seniors.
- **Adaptive Personal Thresholds:** Machine learning models that learn normal family spending rhythms over time.

---

## Team & Hackathon Submission

Built for the **PayPal AI Hackathon** (November 2026).

- **Target Submission:** Thursday, November 12, 2026 at 6:00 PM IST.
- **Devpost Submission:** Complete details in [docs/DEVPOST.md](docs/DEVPOST.md).
- **Demo Video:** Public YouTube walkthrough under 3 minutes (link added upon upload).

---

## License

This project is licensed under the [MIT License](LICENSE).
