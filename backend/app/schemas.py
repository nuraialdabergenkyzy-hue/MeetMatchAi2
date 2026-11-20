from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Goal = Literal[
    "find_job",
    "hire",
    "find_mentor",
    "be_mentor",
    "find_cofounder",
    "exchange_experience",
]
Gender = Literal["male", "female", "other", "undisclosed"]
StackItem = Annotated[str, Field(min_length=1, max_length=40)]
TagItem = Annotated[str, Field(min_length=1, max_length=40)]


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: str | None = Field(default=None, min_length=2, max_length=80)
    stack: list[StackItem] = Field(default_factory=list, max_length=20)
    experience: float = Field(default=0, ge=0, le=60)
    interests: list[TagItem] = Field(default_factory=list, max_length=20)
    about: str = Field(default="", max_length=1000)
    goal: Goal | None = None
    limit: int = Field(default=5, ge=1, le=10)

    @field_validator("stack")
    @classmethod
    def deduplicate_stack(cls, stack: list[str]) -> list[str]:
        seen: set[str] = set()
        unique: list[str] = []
        for item in stack:
            key = item.casefold()
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique


class PersonalProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    age: int | None = Field(default=None, ge=14, le=100)
    gender: Gender | None = None
    city: str | None = Field(default=None, max_length=80)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=16, pattern=r"^\+[1-9]\d{7,14}$")


class ProfessionalProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: str | None = Field(default=None, min_length=2, max_length=80)
    stack: list[StackItem] | None = Field(default=None, max_length=20)
    experience: float | None = Field(default=None, ge=0, le=60)
    interests: list[TagItem] | None = Field(default=None, max_length=20)
    about: str | None = Field(default=None, max_length=1000)
    goal: Goal | None = None


class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    personal: PersonalProfileInput | None = None
    professional: ProfessionalProfileInput | None = None
    is_public: bool | None = None


class MatchPerson(BaseModel):
    id: str
    name: str
    role: str
    score: int
    goal: Goal
    reason: str
    icebreaker: str


class MatchResponse(BaseModel):
    matches: list[MatchPerson]
    processing_ms: int
    total_candidates: int
    fallback_used: bool


class FeedbackInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    match_id: str = Field(min_length=1, max_length=64)
    rating: Literal["like", "dislike", "contacted"]
    comment: str | None = Field(default=None, max_length=500)
    score: int | None = Field(default=None, ge=0, le=100)
    goal: Goal | None = None


class TelegramCodeInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    code: str = Field(pattern=r"^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$")
    telegram_user_id: int = Field(gt=0)
    telegram_username: str | None = Field(default=None, max_length=64)
