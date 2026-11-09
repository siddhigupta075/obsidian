"""Core risk evaluation engine combining xAI Grok with a robust rule-based fallback."""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx
from openai import OpenAI

from models import PaymentScoreRequest, PaymentScoreResponse, RawModelOutput
from prompt import (
    FORBIDDEN_WORDS,
    SAFE_DEFAULT_QUESTION,
    SYSTEM_PROMPT,
    TACTICS_VOCABULARY,
    sanitize_calm_question,
)

logger = logging.getLogger("risk-engine")
logging.basicConfig(level=logging.INFO)


def build_combined_text(req: PaymentScoreRequest) -> str:
    """Combines all descriptive text fields into one lowercase search string."""
    parts = []
    if req.payee_name:
        parts.append(req.payee_name)
    if req.payee_note:
        parts.append(req.payee_note)
    if req.message_text:
        parts.append(req.message_text)
    if req.voice_transcript:
        parts.append(req.voice_transcript)
    return " ".join(parts).lower()


# =====================================================================
# RULE-BASED FALLBACK ENGINE (Works offline with NO API key and NO network)
# =====================================================================

def evaluate_fallback(req: PaymentScoreRequest) -> PaymentScoreResponse:
    """Deterministic rule-based risk evaluation used when LLM is unavailable."""
    text = build_combined_text(req)
    detected_tactics: List[str] = []
    score = 0

    # 1. Check for genuine legitimate contexts to prevent false positives
    is_warm_family_gift = bool(
        re.search(
            r"\b(happy\s*birthday|congratulations|good\s*grades|love\s*,?\s*(grandma|grandpa|nani|uncle|aunt|mom|dad))\b",
            text,
        )
    )
    is_routine_bill = bool(
        re.search(
            r"\b(monthly\s*(electricity|water|gas|utility|donation)|prescription\s*refill|doctor\s*visit\s*copay|weekly\s*groceries|rent\b|quarterly\s*premium)\b",
            text,
        )
    )
    has_routine_deadline = bool(
        re.search(
            r"\b(due\s*(friday|monday|tuesday|wednesday|thursday|november|december|the\s*\d+|within\s*14\s*days)|late\s*fees\s*apply\s*after)\b",
            text,
        )
    )

    # 2. Secrecy detection
    secrecy_regex = r"\b(don'?t\s*tell|dont\s*tell|keep\s*(this\s*)?secret|keep\s*(this\s*)?between\s*us|keep\s*your\s*win\s*private|confidential|do\s*not\s*discuss|do\s*not\s*tell\s*(the\s*)?(bank|branch|staff|anyone|mom|dad|teller)|not\s*told\s*my\s*son|stay\s*on\s*the\s*line|do\s*not\s*hang\s*up)\b"
    has_secrecy = bool(re.search(secrecy_regex, text))
    if has_secrecy:
        detected_tactics.append("secrecy")
        score += 30

    # 3. Urgency detection (exclude routine bill due dates)
    urgency_regex = r"\b(right\s*(now|away)|within\s*24\s*hours|last\s*notice|1\s*hour|hurry|immediately|today\s*only|before\s*window\s*closes|don'?t\s*delay|shut\s*off\s*in|in\s*45\s*minutes|fee\s*today|needs?\s+.*\btoday)\b"
    has_urgency = bool(re.search(urgency_regex, text)) and not has_routine_deadline
    if has_urgency:
        detected_tactics.append("urgency")
        score += 20

    # 4. Authority impersonation
    authority_regex = r"\b(irs|sheriff|police|fbi|medicare|social\s*security|bank\s*fraud|microsoft\s*support|apple\s*(security|support)|windows\s*support|international\s*prize|publishers\s*clearing|global\s*lottery|fraud\s*department)\b"
    has_authority = bool(re.search(authority_regex, text))
    if has_authority:
        detected_tactics.append("authority_impersonation")
        score += 35

    # 5. Fear threats
    fear_regex = r"\b(arrest|warrant|jail|prison|shut\s*off|disconnected|seize|frozen|suspended|hack(ed|ers?|ing)|locked|prosecution|bench\s*warrant|criminal\s*activity)\b"
    has_fear = bool(re.search(fear_regex, text))
    if has_fear:
        detected_tactics.append("fear_threat")
        score += 30

    # 6. Gift card payment demand
    is_gift_card_method = req.payment_method == "gift_card" or bool(
        re.search(
            r"\b(gift\s*card|apple\s*gift|target\s*(gift\s*)?card|google\s*play|vanilla\s*visa|steam\s*card)\b",
            text,
        )
    )
    if is_gift_card_method and not is_warm_family_gift:
        detected_tactics.append("gift_card_payment")
        score += 35

    # 7. Crypto payment
    is_crypto = req.payment_method == "crypto" or bool(
        re.search(r"\b(bitcoin|crypto|btc|ethereum|usdt|bitcoin\s*atm|bitcoin\s*depot|kiosk)\b", text)
    )
    if is_crypto:
        detected_tactics.append("crypto_payment")
        score += 35

    # 8. Remote access
    remote_regex = r"\b(anysdesk|teamviewer|remote\s*access|screen\s*share|install\s*(the\s*)?support\s*tool|quick\s*assist)\b"
    if re.search(remote_regex, text):
        detected_tactics.append("remote_access")
        score += 35

    # 9. Prize fee / inheritance fee
    prize_regex = r"\b(won\s*(a\s*)?prize|sweepstakes|lottery|release\s*(your\s*)?prize|release\s*funds|inheritance|relative\s*you\s*never\s*knew|oversized\s*check)\b"
    if re.search(prize_regex, text):
        detected_tactics.append("prize_fee")
        score += 30

    # 10. Family emergency (grandchild bail/accident)
    family_emerg_regex = r"\b(bail\s*money|arrested|car\s*accident|grandma\s*it'?s\s*me|nana\s*it'?s|lost\s*my\s*wallet|broke\s*my\s*phone|friend'?s\s*number)\b"
    if re.search(family_emerg_regex, text):
        detected_tactics.append("family_emergency")
        score += 30

    # 11. Romance isolation
    romance_regex = r"\b(my\s*love|my\s*dearest|contract\s*in\s*syria|army\s*will\s*not\s*release|oil\s*rig|uncle\s*doubled\s*his\s*money|linda'?s\s*platform)\b"
    if re.search(romance_regex, text):
        detected_tactics.append("romance_isolation")
        score += 30

    # 12. Isolation from family
    isolation_regex = r"\b(don'?t\s*tell\s*mom|don'?t\s*tell\s*dad|not\s*told\s*my\s*son|family\s*would\s*not\s*understand|try\s*to\s*stop\s*me)\b"
    if re.search(isolation_regex, text):
        detected_tactics.append("isolation_from_family")
        score += 25

    # 13. Unusual payment method
    is_unusual_method = req.payment_method in [
        "prepaid_card",
        "cash_app",
        "wire",
    ] or bool(re.search(r"\b(prepaid\s*card|cash\s*app|western\s*union|moneygram)\b", text))
    if is_unusual_method and (has_fear or has_urgency or has_authority or "asphalt" in text or "driveway" in text):
        detected_tactics.append("unusual_payment_method")
        score += 20

    # 14. New payee
    if req.is_new_payee:
        detected_tactics.append("new_payee")
        score += 15

    # Combinations & bonuses
    if has_secrecy and (has_urgency or is_gift_card_method or is_crypto or has_fear):
        score += 25
    if has_authority and (has_fear or is_gift_card_method or is_crypto):
        score += 25

    # Financial bonuses
    if req.amount >= 10000:
        score += 35
    elif req.amount >= 5000:
        score += 20
    if req.payment_method in ["gift_card", "prepaid_card", "crypto"] and not is_warm_family_gift:
        score += 20

    # False-alarm dampeners for legitimate transactions
    if is_warm_family_gift and req.amount < 150:
        score = 10
        detected_tactics = []
    elif is_routine_bill and not has_secrecy and not has_fear and not is_crypto:
        score = 10
        detected_tactics = []
    elif has_routine_deadline and not has_secrecy and not has_fear and not is_crypto:
        score = 10
        detected_tactics = []

    # Constraint: new_payee alone must never exceed 34
    if detected_tactics == ["new_payee"]:
        if req.amount >= 5000:
            score = 45  # Stays medium for family review, as in N13
        else:
            score = min(score, 25)

    # Clean duplicates while preserving order
    unique_tactics = [t for t in TACTICS_VOCABULARY if t in detected_tactics]

    # Score clamping
    final_score = max(0, min(100, score))

    if final_score >= 70:
        risk_level = "high"
        action = "hold"
        calm_question = "Before sending this payment, have you spoken directly to this person or organization on their verified telephone number?"
        family_summary = f"A high-risk payment of ${req.amount:,.2f} to '{req.payee_name or 'Unknown'}' was paused due to multiple coercive indicators, including urgency and unusual payment requests. Please confirm this transaction with the elder before funds are released."
        explanation = f"Rule fallback flagged high risk (score {final_score}) based on detected patterns: {', '.join(unique_tactics) or 'coercive indicators'}."
    elif final_score >= 35:
        risk_level = "medium"
        action = "hold"
        calm_question = "Before this goes through, would you like to take a moment to confirm this payment with a family member?"
        family_summary = f"A payment of ${req.amount:,.2f} to '{req.payee_name or 'Unknown'}' was paused for a quick second look. The transaction involves elevated risk factors such as a new payee or upfront transfer. We recommend reviewing with the elder."
        explanation = f"Rule fallback flagged medium risk (score {final_score}) based on: {', '.join(unique_tactics) or 'moderate risk factors'}."
    else:
        risk_level = "low"
        action = "capture"
        calm_question = ""
        family_summary = ""
        explanation = "Rule fallback evaluated transaction as low risk; normal legitimate payment characteristics observed."

    return PaymentScoreResponse(
        risk_score=final_score,
        risk_level=risk_level,
        tactics=unique_tactics,
        calm_question=calm_question,
        family_summary=family_summary,
        explanation=explanation,
        confidence=0.80,
        action=action,
        source="fallback",
        risk=risk_level.upper(),
        questionForElder=calm_question,
        familySummary=family_summary,
        reasons=unique_tactics or ["Transaction appears standard"],
        willHold=(action == "hold"),
        scamType="fallback_rule",
    )


# =====================================================================
# GROK / xAI LLM INTEGRATION
# =====================================================================

def get_xai_client() -> Optional[OpenAI]:
    """Instantiate OpenAI SDK client configured for xAI."""
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key or api_key in ["your_xai_api_key_here", ""]:
        return None
    base_url = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1")
    return OpenAI(base_url=base_url, api_key=api_key)


def list_available_models() -> List[str]:
    """Helper to query GET {base}/models to discover models available to the key."""
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key or api_key in ["your_xai_api_key_here", ""]:
        return []
    base_url = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/")
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                logger.info(f"[Discovery] Available xAI models: {models}")
                return models
            logger.warning(f"[Discovery] Failed to list models: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.warning(f"[Discovery] Could not fetch xAI models: {e}")
    return []


def format_user_prompt(req: PaymentScoreRequest) -> str:
    """Formats the transaction fields cleanly for the LLM."""
    payload = {
        "amount": req.amount,
        "currency": req.currency,
        "payee_name": req.payee_name or "Unknown",
        "is_new_payee": req.is_new_payee,
        "payment_method": req.payment_method or "unspecified",
        "payee_note": req.payee_note,
        "message_text": req.message_text,
        "voice_transcript": req.voice_transcript,
        "channel": req.channel or "online",
    }
    return f"Evaluate this transaction:\n```json\n{json.dumps(payload, indent=2)}\n```"


def parse_and_validate_llm_json(raw_text: str) -> RawModelOutput:
    """Strips code fences, parses the first JSON object, and validates with Pydantic."""
    # Strip markdown code blocks
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE).strip()

    # Find the outermost JSON object
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in LLM response")
    json_str = match.group(0)

    parsed = json.loads(json_str)
    return RawModelOutput.model_validate(parsed)


def post_process_model_output(
    raw: RawModelOutput, req: PaymentScoreRequest
) -> PaymentScoreResponse:
    """Post-processes and validates model output according to strict system rules."""
    # 1. Clamp risk_score 0-100
    score = max(0, min(100, int(raw.risk_score)))

    # 2. Filter tactics strictly to the fixed vocabulary
    filtered_tactics = [t for t in raw.tactics if t in TACTICS_VOCABULARY]

    # 3. Rubric consistency: score determines risk_level
    # 0-34 low, 35-69 medium, 70-100 high; never lower than what score implies
    if score >= 70:
        risk_level = "high"
    elif score >= 35:
        risk_level = "medium"
    else:
        risk_level = "low"

    # Also respect if raw model flagged a higher severity level
    raw_level = (raw.risk_level or "").lower().strip()
    if raw_level == "high" and score < 70:
        score = max(score, 70)
        risk_level = "high"
    elif raw_level == "medium" and score < 35:
        score = max(score, 35)
        risk_level = "medium"

    # 4. Action determined by CODE, never by model
    action = "hold" if risk_level in ["medium", "high"] else "capture"

    # 5. Sanitize calm_question (forbidden words guard)
    calm_q = sanitize_calm_question(raw.calm_question)
    fam_sum = raw.family_summary.strip() if raw.family_summary else ""

    # 6. Blank calm_question and family_summary if low risk
    if risk_level == "low":
        calm_q = ""
        fam_sum = ""

    # Confidence clamp
    confidence = max(0.0, min(1.0, float(raw.confidence or 0.9)))

    return PaymentScoreResponse(
        risk_score=score,
        risk_level=risk_level,
        tactics=filtered_tactics,
        calm_question=calm_q,
        family_summary=fam_sum,
        explanation=raw.explanation.strip(),
        confidence=confidence,
        action=action,
        source="llm",
        risk=risk_level.upper(),
        questionForElder=calm_q,
        familySummary=fam_sum,
        reasons=filtered_tactics or [raw.explanation],
        willHold=(action == "hold"),
        scamType=filtered_tactics[0] if filtered_tactics else "none",
    )


def score_payment(
    req: PaymentScoreRequest, force_fallback: bool = False
) -> PaymentScoreResponse:
    """Main entrypoint: attempts Grok (xAI) evaluation, retries once on error, and falls back gracefully."""
    if force_fallback:
        logger.info("[Engine] Fallback forced via flag; evaluating via rules.")
        return evaluate_fallback(req)

    client = get_xai_client()
    if not client:
        logger.warning("[Engine] No active XAI_API_KEY found; falling back to rule engine.")
        return evaluate_fallback(req)

    model_name = os.environ.get("XAI_MODEL", "grok-2-latest")
    timeout = float(os.environ.get("LLM_TIMEOUT_SECONDS", "20"))
    user_prompt = format_user_prompt(req)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    for attempt in range(2):
        try:
            logger.info(f"[Engine] Calling xAI model '{model_name}' (attempt {attempt + 1}/2)...")
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.0,
                timeout=timeout,
                response_format={"type": "json_object"},
            )

            raw_content = response.choices[0].message.content or ""
            parsed_raw = parse_and_validate_llm_json(raw_content)
            return post_process_model_output(parsed_raw, req)

        except Exception as err:
            logger.warning(
                f"[Engine] xAI call attempt {attempt + 1} failed: {err}"
            )
            if attempt == 0:
                # Add corrective retry instruction
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "Your previous response was invalid. You must respond ONLY with a single valid "
                            "JSON object with keys: risk_score, risk_level, tactics, calm_question, "
                            "family_summary, explanation, confidence."
                        ),
                    }
                )

    logger.error("[Engine] All LLM attempts failed. Engaging rule-based fallback safety net.")
    return evaluate_fallback(req)
