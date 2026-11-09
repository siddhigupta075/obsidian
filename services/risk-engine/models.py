"""Data models and schemas for the risk engine service."""

from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, AliasChoices, field_validator


class PaymentScoreRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    amount: float
    currency: str = "USD"
    payment_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("payment_id", "paymentId", "id"),
    )
    payee_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "payee_name", "payeeName", "payeeLabel", "payee"
        ),
    )
    is_new_payee: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("is_new_payee", "isNewPayee"),
    )
    payment_method: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "payment_method", "paymentMethod", "method"
        ),
    )
    payee_note: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("payee_note", "payeeNote", "note"),
    )
    message_text: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "message_text", "messageText", "message", "text"
        ),
    )
    voice_transcript: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "voice_transcript", "voiceTranscript", "transcript"
        ),
    )
    channel: Optional[str] = None


class RawModelOutput(BaseModel):
    """Raw structured output parsed from the LLM."""

    risk_score: int
    risk_level: str
    tactics: List[str] = Field(default_factory=list)
    calm_question: str = ""
    family_summary: str = ""
    explanation: str = ""
    confidence: float = 0.9


class PaymentScoreResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    risk_score: int = Field(..., ge=0, le=100)
    risk_level: Literal["low", "medium", "high"]
    tactics: List[str]
    calm_question: str
    family_summary: str
    explanation: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    action: Literal["hold", "capture"]
    source: Literal["llm", "fallback"]

    # Extended compatibility fields for existing Node backend
    risk: str = "LOW"
    questionForElder: str = ""
    familySummary: str = ""
    reasons: List[str] = Field(default_factory=list)
    willHold: bool = False
    scamType: str = "none"

    @field_validator("risk_score")
    @classmethod
    def clamp_score(cls, v: int) -> int:
        return max(0, min(100, int(v)))

