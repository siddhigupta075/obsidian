"""FastAPI application for the Second Sight Risk Engine."""

import logging
import os
from contextlib import asynccontextmanager
from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from engine import (
    evaluate_fallback,
    list_available_models,
    score_payment,
)
from models import PaymentScoreRequest, PaymentScoreResponse

load_dotenv()

logger = logging.getLogger("risk-engine")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & shutdown lifecycle."""
    logger.info("==================================================")
    logger.info("🛡️ Second Sight — Risk Engine Starting Up")
    logger.info("==================================================")
    api_key = os.environ.get("XAI_API_KEY")
    if api_key and api_key not in ["your_xai_api_key_here", ""]:
        logger.info("[Startup] XAI_API_KEY detected. Discovering available xAI models...")
        models = list_available_models()
        configured_model = os.environ.get("XAI_MODEL", "grok-2-latest")
        if models and configured_model not in models:
            logger.info(
                f"[Startup] Configured model '{configured_model}' not in discovered list {models}. Defaulting to '{models[0]}'."
            )
        else:
            logger.info(f"[Startup] Using xAI model: {configured_model}")
    else:
        logger.warning(
            "[Startup] No active XAI_API_KEY found. Running in rule-based fallback mode."
        )
    logger.info("==================================================")
    yield
    logger.info("🛡️ Second Sight — Risk Engine Shutting Down")


app = FastAPI(
    title="Second Sight Risk Engine",
    description="Intelligent scam evaluation service powered by xAI Grok and rule-based fallback.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/")
def root_info() -> Dict[str, str]:
    """Root info endpoint."""
    return {"service": "Second Sight Risk Engine", "status": "running"}


@app.post("/score", response_model=PaymentScoreResponse)
async def score_endpoint(request: PaymentScoreRequest) -> PaymentScoreResponse:
    """Evaluates payment risk using Grok (xAI) with fail-safe fallback."""
    try:
        return score_payment(request)
    except Exception as e:
        logger.error(f"[ScoreEndpoint] Unexpected error: {e}. Executing fail-safe fallback.")
        return evaluate_fallback(request)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Guarantees the service never fails open or crashes with an unhandled 500."""
    logger.error(f"[GlobalExceptionHandler] Unhandled exception: {exc}")
    try:
        body = await request.json()
        req = PaymentScoreRequest.model_validate(body)
        fallback = evaluate_fallback(req)
        return JSONResponse(status_code=200, content=fallback.model_dump())
    except Exception:
        # Ultimate fail-safe response
        return JSONResponse(
            status_code=200,
            content={
                "risk_score": 50,
                "risk_level": "medium",
                "tactics": ["unusual_payment_method"],
                "calm_question": "Before sending this payment, would you like to verify it with a family member?",
                "family_summary": "Transaction evaluation encountered an unexpected state. Paused as a precaution for family review.",
                "explanation": "Fail-safe response triggered due to server exception.",
                "confidence": 0.5,
                "action": "hold",
                "source": "fallback",
                "risk": "MEDIUM",
                "questionForElder": "Before sending this payment, would you like to verify it with a family member?",
                "familySummary": "Transaction evaluation encountered an unexpected state. Paused as a precaution for family review.",
                "reasons": ["Automated safety check required verification"],
                "willHold": True,
                "scamType": "fallback",
            },
        )

