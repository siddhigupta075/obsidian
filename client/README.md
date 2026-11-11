# SecondSight — Frontend Client

React 19 + Vite 8 + TypeScript + Tailwind CSS v4 frontend for SecondSight.

For full architecture, environment setup, and PayPal Sandbox testing instructions, see the root [`README.md`](../README.md).

## Key Views & Components

- `src/pages/ElderPaymentView.tsx`: Calm payment entry form, voice note dictation (`VoiceCapture.tsx`), AI risk check feedback (`PaymentAnalysisView.tsx`), PayPal Authorize checkout (`PayPalButton.tsx`), and elder pause screen (`PausedStatusView.tsx` / `PaymentResultView.tsx`).
- `src/pages/FamilyDashboardView.tsx`: Family reviewer dashboard showing active held payments, scam context summary, Approve/Decline decision controls, hold history, and protected savings total.

## Scripts

Run inside `client/`:

```bash
npm run dev       # Start Vite dev server on http://localhost:5173 (proxies /api and /health to :3000)
npm run build     # Type-check with tsc and build production assets to dist/
npm run lint      # Lint with oxlint
npm run preview   # Preview production build
```
