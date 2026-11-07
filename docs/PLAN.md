# Project Plan: Second Sight
### Hackathon Execution Roadmap & Operational Strategy

---

## 1. Overview & Pitch
* **Project Name:** Second Sight
* **One-Line Pitch:** "We pause risky payments before the money leaves, and a trusted family member can approve or stop them."
* **Tagline:** "Pause the payment. Not the person."
* **Hard Deadline:** Friday, Nov 13, 2026, 1:30 AM IST (Devpost)
* **Target Submission Time:** Thursday, Nov 12, 2026, 6:00 PM IST (leaving a buffer for contingencies)

---

## 2. Team Roles & Responsibilities

| Role | Responsibility Area | Core Tasks & Deliverables |
|---|---|---|
| **P1** | PayPal Backend | PayPal Developer Sandbox, Authorization/Capture API lifecycle, Payment status persistence |
| **P2** | AI Engine & Safety | Scam evaluation model, prompt optimization, structured JSON output & metric benchmarks |
| **P3** | Frontend Dev | Elder payment UI, Accessibility design, Paused status, Family Approval web flow |
| **P4** | Polish & Hosting | Infrastructure deployment, GitHub repo, README, video production & submission details (shared) |

---

## 3. Execution Schedule & Daily Milestones

### Saturday (Tonight): Setup & Core Proof of Concept
* **Group Objectives:**
  * Finalize one-line pitch.
  * Create public GitHub repository with an **MIT license** (critical for judging).
  * Write the 30-second demo story and script. Build strictly what is needed for the demo.
  * Finalize technology stack and set up hosting on Render.
* **Parallel Responsibilities:**
  * **P1:** Set up PayPal developer account, sandbox app, 1 business receiver account, and 1 personal elder account. Write a test script implementing order `AUTHORIZE`, approval, authorization, and `VOID` lifecycle.
  * **P2:** Create 25–30 test messages (`server/test/ai-eval.json`: 15+ scam variants, 10+ normal payments). Draft initial prompt returning structured JSON.
  * **P3:** Wireframe 3 primary screens: Elder payment screen, "Paused" status screen, and Family approval page.
  * **P4:** Initialize repository skeleton, `.env.example`, `AGENTS.md`, `README.md`, and `docs/API.md`.
* **Milestone Definition of Done:** Prove money hold/cancel flow by executing a script that holds and voids a single sandbox payment.

---

### Sunday: Core Money Flow & Integration
* **Parallel Responsibilities:**
  * **P1:** Implement API endpoints for create, authorize, capture, and void actions. Set up lightweight database schema (Mongoose) to track payment statuses.
  * **P2:** Build AI risk evaluation endpoint (input: amount, payee, message; output: structured JSON). Evaluate against the test set and record precision/recall metrics.
  * **P3:** Build Elder screen with PayPal integration button and placeholder "paused" view with hardcoded risk values.
  * **P4:** Deploy initial build to public Render URL.
* **Milestone Definition of Done:** Complete end-to-end payment hold, with capture/void actions triggered via admin controls.

---

### Monday: AI Decision Engine & Family Workflow
* **Parallel Responsibilities:**
  * **P1:** Enforce risk logic (low risk captures instantly; medium/high risk holds and auto-voids after 24 hours). Configure demo timer to 2 minutes.
  * **P2:** Integrate AI engine into live flow to generate gentle explanations for elders and concise summaries for family members.
  * **P3:** Build Family Approval Page accessible via unique link, featuring explicit approve/decline buttons.
  * **P4:** Implement family-configured spending limits and conduct user testing with 5 outside participants.
* **Milestone Definition of Done:** Full user journey operates successfully from payment attempt to family resolution.

---

### Tuesday: Feature Freeze & Polish
* **Key Deliverables:**
  * Integrate voice input (Browser Web Speech API), large typography, and reassuring copy ("paused for a second look").
  * Build simple Family Dashboard summarizing paused transactions and decision history.
  * Deploy final build. Enforce strict feature freeze after tonight.

---

### Wednesday: Documentation & Demo Preparation
* **Key Deliverables:**
  * Address error handling and edge cases (e.g., handling PayPal API errors gracefully).
  * Write comprehensive README covering project description, setup guide, environment variables, and judge sandbox credentials.
  * Prepare Devpost submission text detailing features, AI implementation, and PayPal APIs utilized.
  * Conduct two demo rehearsals and record an initial video draft.

---

### Thursday: Final Submission & Shipping
* **Key Deliverables:**
  * **Morning:** Record final public YouTube demo video (< 3 minutes, clean audio, no copyrighted music/logos).
  * **Afternoon:** Submit on Devpost; test hosted app in incognito mode and conduct fresh user trial.
  * **Target Deadline:** Complete all steps by **6:00 PM IST** (Friday 1:30 AM IST reserved solely for emergency buffer).

---

## 4. Video Outline (Target: ~2:45)

| Timeframe | Topic | Content & Key Highlights |
|---|---|---|
| **0:00 – 0:20** | Problem Statement | Elder financial fraud loss statistics and the emotional vulnerability exploited by scammers. |
| **0:20 – 1:50** | Live Demonstration | Side-by-side browser windows: Scam transaction paused $\rightarrow$ family decline $\rightarrow$ funds preserved; followed by instant normal payment flow. |
| **1:50 – 2:25** | Technical Architecture | Explain PayPal `AUTHORIZE` / `CAPTURE` / `VOID` mechanism coupled with dual-check AI risk evaluation. |
| **2:25 – 2:45** | Target Impact & Roadmap | Overview of real-world deployment goals, security safeguards, and future B2B API vision. |

---

## 5. Final Submission Checklist

- [ ] Public GitHub repository containing an explicit MIT license in the About section.
- [ ] Fully functional hosted demo URL on Render (with warm-up note).
- [ ] Complete Devpost submission text detailing tech stack, AI models, and PayPal API utilization.
- [ ] Public YouTube demo video under 3 minutes showing real execution.
- [ ] Working sandbox test credentials provided for hackathon judges in README.
