import json
import secrets
from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.matching import MatchingIndex
from app.models import Profile
from app.schemas import ProfileInput
from app.security import Actor, resolve_actor

router = APIRouter(prefix="/api/profile", tags=["profile"])


def find_profile(db: Session, actor: Actor) -> Profile | None:
    if actor.is_bot:
        telegram_id = actor.user_id.removeprefix("telegram:")
        return db.scalar(select(Profile).where(Profile.telegram_user_id == telegram_id))
    return db.scalar(select(Profile).where(Profile.user_id == actor.user_id))


def serialize(profile: Profile) -> dict[str, Any]:
    updated = profile.updated_at
    if updated and updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    return {
        "user_id": profile.user_id,
        "public_id": profile.public_id,
        "personal": {"full_name": profile.name, "age": profile.age, "gender": profile.gender,
                     "city": profile.city, "email": profile.email, "phone": profile.phone},
        "professional": {"role": profile.role, "stack": json.loads(profile.skills_json or "[]"),
                          "experience": profile.experience_years, "interests": json.loads(profile.interests_json or "[]"),
                          "about": profile.bio, "goal": profile.goal},
        "is_public": profile.is_public,
        "telegram_linked": profile.telegram_user_id is not None,
        "updated_at": updated.isoformat() if updated else None,
    }


def index_profile(profile: Profile) -> dict[str, Any]:
    return {"id": profile.public_id or profile.id, "user_id": profile.user_id, "name": profile.name,
            "role": profile.role, "goal": profile.goal, "skills": json.loads(profile.skills_json or "[]"),
            "interests": json.loads(profile.interests_json or "[]"), "experience_years": profile.experience_years,
            "bio": profile.bio}


@router.get("/me")
def get_profile(actor: Actor = Depends(resolve_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    profile = find_profile(db, actor)
    if profile is None:
        if actor.is_bot:
            raise HTTPException(status_code=401, detail="UNAUTHORIZED|Telegram account is not linked")
        raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND|Profile not found")
    return serialize(profile)


@router.put("/me")
def save_profile(payload: ProfileInput, request: Request, actor: Actor = Depends(resolve_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    profile = find_profile(db, actor)
    personal = payload.personal.model_dump(exclude_unset=True) if payload.personal else {}
    professional = payload.professional.model_dump(exclude_unset=True) if payload.professional else {}
    if profile is None:
        if not personal.get("full_name") or not personal.get("email"):
            raise HTTPException(status_code=422, detail="INITIAL_PROFILE_REQUIRED|personal.full_name and personal.email are required")
        profile = Profile(id=f"user:{actor.user_id}" if not actor.is_bot else f"telegram:{actor.user_id.removeprefix('telegram:')}",
                          user_id=None if actor.is_bot else actor.user_id,
                          public_id=f"real_{secrets.token_hex(4)}", name=personal["full_name"], role="", goal="exchange_experience")
        db.add(profile)
    for key, column in (("full_name", "name"), ("age", "age"), ("gender", "gender"), ("city", "city"), ("email", "email"), ("phone", "phone")):
        if key in personal:
            setattr(profile, column, personal[key])
    for key, column in (("role", "role"), ("experience", "experience_years"), ("about", "bio"), ("goal", "goal")):
        if key in professional:
            setattr(profile, column, professional[key])
    for key, column in (("stack", "skills_json"), ("interests", "interests_json")):
        if key in professional:
            setattr(profile, column, json.dumps(professional[key], ensure_ascii=False))
    if payload.is_public is not None:
        profile.is_public = payload.is_public
    db.commit()
    db.refresh(profile)
    index: MatchingIndex = request.app.state.matching_index
    if profile.is_public and profile.role and profile.goal:
        index.replace(index_profile(profile))
    else:
        index.remove(profile.public_id or profile.id)
    return serialize(profile)
