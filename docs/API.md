# Second Sight — API Reference

This document defines the REST API contract for Second Sight. All requests and responses use JSON format.

---

## Base URL
- Express Server: `http://localhost:3000` (Production: `https://second-sight.onrender.com`)
- Python Risk Engine: `http://localhost:8001` (Production: `https://second-sight-risk-engine.onrender.com`)

---

## 0. AI Risk Engine Service (Python Grok Engine)

The risk engine runs as an independent microservice (`services/risk-engine/`) on port 8001, providing real-time evaluation with xAI Grok and rule-based fallback.

### `GET /health`
Returns service status.
```json
{
  "status": "ok"
}
```

### `POST /score`
Scores a proposed payment and returns a calm question for the elder, a plain-language summary for the family, and detected tactics.

#### Request
Accepts both snake_case and camelCase parameters.
```json
{
  "amount": 2500,
  "currency": "USD",
  "payee_name": "Metro Bail Services",
  "is_new_payee": true,
  "payment_method": "wire",
  "payee_note": "Bail for Tommy",
  "message_text": "Grandma Tommy is in jail please wire money right now and don't tell mom and dad."
}
```

#### Response (`200 OK`)
```json
{
  "risk_score": 92,
  "risk_level": "high",
  "tactics": [
    "urgency",
    "secrecy",
    "family_emergency",
    "unusual_payment_method",
    "new_payee"
  ],
  "calm_question": "Before this goes through, have you spoken directly to Tommy on his usual number?",
  "family_summary": "A payment of $2,500 was requested via wire for an alleged grandchild emergency. Secrecy was requested from family members. Please verify Tommy's safety before approving.",
  "explanation": "High risk driven by family emergency script, secrecy instructions, and wire transfer to a new payee.",
  "confidence": 0.95,
  "action": "hold",
  "source": "llm",
  "risk": "HIGH",
  "scamType": "family_emergency",
  "questionForElder": "Before this goes through, have you spoken directly to Tommy on his usual number?",
  "familySummary": "A payment of $2,500 was requested via wire for an alleged grandchild emergency...",
  "reasons": ["urgency", "secrecy", "family_emergency"],
  "willHold": true
}
```

---

## 1. Risk Pre-Check

### `POST /api/check`
Evaluates the proposed transaction using deterministic rules and AI semantic scam detection. Creates a `Payment` record with status `CHECKED`.

#### Request
```json
{
  "elderId": "654c1234567890abcdef1234",
  "amount": 500,
  "payeeLabel": "Mike",
  "message": "Pay in gift cards right now or police will arrest you"
}
```

#### Response (`200 OK`)
```json
{
  "paymentId": "654c9876543210fedcba5678",
  "risk": "HIGH",
  "reasons": [
    "Requests gift cards",
    "Threatens law enforcement or arrest",
    "Artificial urgency"
  ],
  "questionForElder": "Did someone ask you to keep this secret or pay right now?",
  "willHold": true
}
```

---

## 2. PayPal Order Creation

### `POST /api/orders`
Creates a PayPal order with `intent: "AUTHORIZE"`.
> **Safety Rule:** All monetary amounts, currency codes, and recipient descriptions are read directly from the stored `Payment` in MongoDB. The client cannot modify the amount.

#### Request
```json
{
  "paymentId": "654c9876543210fedcba5678"
}
```

#### Response (`201 Created`)
```json
{
  "orderId": "5O190127TN364715T"
}
```

---

## 3. Order Authorization & Routing

### `POST /api/orders/:orderId/authorize`
Called after the elder approves the order inside the PayPal popup window. Authorizes the funds on PayPal without capturing them.
- If risk is `LOW`: captures money immediately -> status `CAPTURED`.
- If risk is `MEDIUM` or `HIGH`: pauses money movement -> status `HELD`.

> **Safety Rule:** Never return `holdToken` or family approval URLs in this response.

#### Request
No request body needed.

#### Response: Low-Risk Immediate Capture (`200 OK`)
```json
{
  "status": "CAPTURED",
  "paymentId": "654c9876543210fedcba5678",
  "message": "Payment sent successfully"
}
```

#### Response: Held for Family Approval (`200 OK`)
```json
{
  "status": "HELD",
  "paymentId": "654c9876543210fedcba5678",
  "message": "Paused for a second look. We asked your family to confirm."
}
```

---

## 4. Payment Status (Elder Polling)

### `GET /api/payments/:id/status`
Polled by the elder's screen every 3–5 seconds while on the paused page. Triggers a lazy expiry check.

#### Response (`200 OK`)
```json
{
  "status": "HELD",
  "decision": null,
  "message": "Paused for a second look. We asked your family to confirm."
}
```

When resolved:
```json
{
  "status": "VOIDED",
  "decision": "DECLINED",
  "message": "Not sent. Your family stopped this one."
}
```

---

## 5. Family Pending Holds

### `GET /api/holds`
Returns hold requests linked to the family member. Triggers lazy expiry of outdated holds.

#### Query Parameters
- `familyId` (string, required): MongoDB User ID of the family member.
- `status` (string, optional): Filter by `pending` (default) or `all`.

#### Response (`200 OK`)
```json
{
  "holds": [
    {
      "token": "a8f3b9c7-e451-409b-8f19-3fbc0d249a12",
      "paymentId": "654c9876543210fedcba5678",
      "amount": 500,
      "payeeLabel": "Mike",
      "message": "Pay in gift cards right now or police will arrest you",
      "risk": "HIGH",
      "reasons": [
        "Requests gift cards",
        "Threatens law enforcement or arrest",
        "Artificial urgency"
      ],
      "familySummary": "The sender claims the elder will be arrested unless $500 in gift cards is delivered immediately. This fits an authority imposter scam pattern.",
      "expiresAt": "2026-11-08T22:45:00.000Z",
      "status": "HELD"
    }
  ]
}
```

---

## 6. Single Hold Detail

### `GET /api/holds/:token`
Retrieves a specific hold by its unguessable secure token.

#### Response (`200 OK`)
Returns the single hold object with same fields as above.

---

## 7. Family Decision (Approve / Decline)

### `POST /api/holds/:token/decision`
Submits a family member's decision on a held payment.
- `approve`: Triggers PayPal CAPTURE on the authorized order.
- `decline`: Triggers PayPal VOID on the authorized order.

Uses atomic status locking (`HELD` -> `PROCESSING`) to prevent duplicate captures or voids.

#### Request
```json
{
  "decision": "decline"
}
```

#### Response (`200 OK`)
```json
{
  "status": "VOIDED",
  "message": "Payment was declined and voided. No money left the account."
}
```

---

## 8. Health Check

### `GET /health`
Used by pinging services (e.g., cron-job.org or UptimeRobot) to prevent Render free instance spin-down. Does not query the database.

#### Response (`200 OK`)
```json
{
  "ok": true
}
```

---

## 9. Demo Identity Switcher

### `GET /api/demo/users`
Provides mock seeded users and the configured Sandbox PayPal Client ID for rapid two-window testing.

#### Response (`200 OK`)
```json
{
  "paypalClientId": "<PAYPAL_CLIENT_ID>",
  "elder": {
    "_id": "654c1234567890abcdef1234",
    "name": "Margaret Davis",
    "role": "elder",
    "email": "margaret@example.com"
  },
  "family": {
    "_id": "654c1234567890abcdef5678",
    "name": "Sarah Davis",
    "role": "family",
    "email": "sarah@example.com"
  },
  "familyLink": {
    "amountLimit": 100
  }
}
```

---

## 10. PayPal Webhooks

### `POST /api/webhooks`
Receives asynchronous PayPal Sandbox webhook notifications (such as `PAYMENT.AUTHORIZATION.VOIDED` and `PAYMENT.CAPTURE.COMPLETED`) to synchronize local `Payment` state.

#### Supported Event Types
- `PAYMENT.AUTHORIZATION.VOIDED`
- `PAYMENT.CAPTURE.COMPLETED`

---

## Common Error Format

All error responses use standard HTTP status codes and provide a clear JSON error payload:
```json
{
  "error": "Payment has already been processed or expired."
}
```
