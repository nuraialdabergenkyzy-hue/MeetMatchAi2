import json
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.matching import MatchingIndex
from app.models import Profile
from app.schemas import MatchRequest, MatchResponse
from app.security import Actor, get_optional_user, identify_actor

router = APIRouter(prefix="/api", tags=["matching"])


def profile_dict(profile: Profile) -> dict[str, Any]:
    return {"id": profile.public_id or profile.id, "user_id": profile.user_id, "name": profile.name,
            "role": profile.role, "goal": profile.goal, "skills": json.loads(profile.skills_json or "[]"),
            "interests": json.loads(profile.interests_json or "[]"), "experience_years": profile.experience_years,
            "bio": profile.bio}


@router.post("/match", response_model=MatchResponse)
def match_profiles(request: Request, payload: MatchRequest, db: Session = Depends(get_db),
                   optional_actor: Actor | None = Depends(get_optional_user),
                   x_bot_key: str | None = Header(default=None),
                   x_telegram_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    started = time.perf_counter()
    actor = identify_actor(optional_actor, x_bot_key, x_telegram_user_id)
    if x_bot_key and actor is None:
        raise HTTPException(status_code=401, detail="INVALID_BOT_CREDENTIALS|Invalid bot credentials")
    # An empty/limit-only request means “match me” and requires an existing profile.
    if payload.role is None or payload.goal is None:
        if actor is None:
            raise HTTPException(status_code=422, detail="MATCH_PROFILE_REQUIRED|role and goal are required for anonymous matching")
        if actor.is_bot:
            profile = db.scalar(select(Profile).where(Profile.telegram_user_id == x_telegram_user_id))
        else:
            profile = db.scalar(select(Profile).where(Profile.user_id == actor.user_id))
        if profile is None:
            if actor.is_bot:
                raise HTTPException(status_code=401, detail="UNAUTHORIZED|Telegram account is not linked")
            raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND|Profile not found")
        seeker = profile_dict(profile)
    else:
        requester_profile = None
        if actor and actor.is_bot:
            requester_profile = db.scalar(select(Profile).where(Profile.telegram_user_id == x_telegram_user_id))
        elif actor:
            requester_profile = db.scalar(select(Profile).where(Profile.user_id == actor.user_id))
        seeker = {"id": (requester_profile.public_id or requester_profile.id) if requester_profile else (actor.user_id if actor else "anonymous-query"),
                  "user_id": requester_profile.user_id if requester_profile else (actor.user_id if actor and not actor.is_bot else None),
                  "role": payload.role,
                  "skills": payload.stack, "experience_years": payload.experience,
                  "interests": payload.interests, "bio": payload.about, "goal": payload.goal}
    index: MatchingIndex = request.app.state.matching_index
    matches, total, fallback = index.match(seeker, limit=payload.limit)
    elapsed = int((time.perf_counter() - started) * 1000)
    return {"matches": matches, "processing_ms": elapsed, "total_candidates": total, "fallback_used": fallback}
