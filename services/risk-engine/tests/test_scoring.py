"""Unit tests for the scoring engine, validation, and post-processing."""

import os
from unittest.mock import MagicMock, patch

import pytest
from engine import (
    evaluate_fallback,
    format_user_prompt,
    parse_and_validate_llm_json,
    post_process_model_output,
    score_payment,
)
from models import PaymentScoreRequest, PaymentScoreResponse, RawModelOutput
from prompt import FORBIDDEN_WORDS, TACTICS_VOCABULARY, sanitize_calm_question


def test_request_aliases():
    """Verify camelCase and snake_case aliases work correctly."""
    req1 = PaymentScoreRequest.model_validate(
        {
            "amount": 250.0,
            "payeeLabel": "IRS Agent",
            "message": "Pay immediate warrant",
            "isNewPayee": True,
            "paymentMethod": "gift_card",
        }
    )
    assert req1.amount == 250.0
    assert req1.payee_name == "IRS Agent"
    assert req1.message_text == "Pay immediate warrant"
    assert req1.is_new_payee is True
    assert req1.payment_method == "gift_card"

    req2 = PaymentScoreRequest.model_validate(
        {
            "amount": 100.0,
            "payee_name": "Corner Pharmacy",
            "message_text": "Prescription",
            "is_new_payee": False,
        }
    )
    assert req2.payee_name == "Corner Pharmacy"
    assert req2.message_text == "Prescription"


def test_level_score_consistency():
    """Verify risk_level strictly matches score thresholds (0-34 low, 35-69 med, 70-100 high)."""
    req = PaymentScoreRequest(amount=100.0)

    # Low score
    raw_low = RawModelOutput(risk_score=20, risk_level="low", explanation="Normal")
    res_low = post_process_model_output(raw_low, req)
    assert res_low.risk_level == "low"
    assert res_low.action == "capture"
    assert res_low.calm_question == ""
    assert res_low.family_summary == ""

    # Medium score
    raw_med = RawModelOutput(risk_score=50, risk_level="medium", calm_question="Are you sure?")
    res_med = post_process_model_output(raw_med, req)
    assert res_med.risk_level == "medium"
    assert res_med.action == "hold"

    # High score
    raw_high = RawModelOutput(risk_score=85, risk_level="high", calm_question="Please verify.")
    res_high = post_process_model_output(raw_high, req)
    assert res_high.risk_level == "high"
    assert res_high.action == "hold"


def test_forbidden_words_guard():
    """Verify forbidden words in calm_question are sanitized."""
    for word in FORBIDDEN_WORDS:
        dirty_question = f"This looks like a {word}, please do not send money."
        sanitized = sanitize_calm_question(dirty_question)
        for w in FORBIDDEN_WORDS:
            assert w not in sanitized.lower(), f"Forbidden word '{w}' leaked into sanitized question"

    clean_question = "Before this payment goes through, have you spoken to Tommy directly?"
    assert sanitize_calm_question(clean_question) == clean_question


def test_tactic_vocabulary_filtering():
    """Verify unknown tactics are filtered out."""
    req = PaymentScoreRequest(amount=50.0)
    raw = RawModelOutput(
        risk_score=75,
        risk_level="high",
        tactics=["urgency", "some_hallucinated_tactic", "secrecy"],
    )
    res = post_process_model_output(raw, req)
    assert "some_hallucinated_tactic" not in res.tactics
    assert "urgency" in res.tactics
    assert "secrecy" in res.tactics


def test_fallback_never_throws():
    """Verify fallback handles strange or empty payloads gracefully."""
    empty_req = PaymentScoreRequest(amount=0.0)
    res = evaluate_fallback(empty_req)
    assert res.risk_level in ["low", "medium", "high"]
    assert res.action in ["hold", "capture"]
    assert res.source == "fallback"

    huge_req = PaymentScoreRequest(
        amount=999999.0,
        payee_name=None,
        message_text="??? /// !!!",
        is_new_payee=None,
    )
    res_huge = evaluate_fallback(huge_req)
    assert res_huge.action == "hold"


def test_clearly_scam_payload_is_high():
    """Verify an explicit scam payload results in high risk."""
    req = PaymentScoreRequest(
        amount=2500.0,
        payee_name="Sheriff Arrest Department",
        payment_method="gift_card",
        message_text="You have a warrant. Buy Apple cards right now and don't tell the bank or you will go to jail.",
        is_new_payee=True,
    )
    res = score_payment(req, force_fallback=True)
    assert res.risk_level == "high"
    assert res.action == "hold"
    assert res.risk_score >= 70
    assert "authority_impersonation" in res.tactics
    assert "fear_threat" in res.tactics


def test_clearly_normal_payload_is_low():
    """Verify a legitimate payment results in low risk."""
    req = PaymentScoreRequest(
        amount=45.0,
        payee_name="Green Thumb Lawn Mowing",
        payment_method="card",
        payee_note="Biweekly lawn care",
        is_new_payee=False,
    )
    res = score_payment(req, force_fallback=True)
    assert res.risk_level == "low"
    assert res.action == "capture"
    assert res.risk_score <= 34
    assert res.calm_question == ""


def test_malformed_llm_json_triggers_fallback():
    """Verify malformed model response retries once and safely drops back to rule engine."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Not a json response at all! Internal error."
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_response

    with patch("engine.get_xai_client", return_value=mock_client):
        req = PaymentScoreRequest(
            amount=500.0,
            payee_name="Target Gift",
            message_text="Pay in gift cards immediately or police arrest you",
        )
        res = score_payment(req, force_fallback=False)
        # Should cleanly fall back to rules
        assert res.source == "fallback"
        assert res.risk_level == "high"
        assert res.action == "hold"
        assert mock_client.chat.completions.create.call_count == 2

