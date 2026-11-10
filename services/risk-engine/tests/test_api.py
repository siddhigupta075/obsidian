"""Integration tests for the FastAPI HTTP endpoints."""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

CURRENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(CURRENT_DIR))

from main import app
from prompt import FORBIDDEN_WORDS

client = TestClient(app)


def test_health_endpoint():
    """Verify GET /health returns 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_endpoint():
    """Verify GET / returns 200 with service info."""
    response = client.get("/")
    assert response.status_code == 200
    assert "service" in response.json()


def test_score_scam_payload():
    """Verify POST /score with scam payload returns risk_level high and action hold."""
    payload = {
        "amount": 2500.0,
        "payee_name": "Metro Bail Bonds",
        "payment_method": "wire",
        "is_new_payee": True,
        "message_text": "Grandma Tommy is in jail please wire money right now and don't tell mom and dad.",
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "high"
    assert data["action"] == "hold"
    assert data["risk_score"] >= 70
    assert len(data["calm_question"]) > 5
    for forbidden in FORBIDDEN_WORDS:
        assert forbidden not in data["calm_question"].lower()


def test_score_normal_payload():
    """Verify POST /score with normal payload returns risk_level low and action capture."""
    payload = {
        "amount": 35.0,
        "payee_name": "Corner Pharmacy",
        "payment_method": "card",
        "is_new_payee": False,
        "payee_note": "Prescription refill",
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "low"
    assert data["action"] == "capture"
    assert data["calm_question"] == ""
    assert data["family_summary"] == ""


def test_score_camel_case_input():
    """Verify POST /score accepts camelCase fields from Node backend."""
    payload = {
        "amount": 80.0,
        "payeeLabel": "Bob's Plumbing",
        "message": "Fixing leaking kitchen pipe",
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "low"
    assert data["action"] == "capture"


def test_score_unhandled_exception_safely_handled():
    """Verify that if an unhandled error occurs, the endpoint never crashes with a 500."""
    with patch("main.score_payment", side_effect=RuntimeError("Simulated unexpected crash")):
        payload = {
            "amount": 600.0,
            "payee_name": "IRS Tax Dept",
            "message_text": "Pay warrant now or arrest",
        }
        response = client.post("/score", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "hold"
        assert data["source"] == "fallback"

