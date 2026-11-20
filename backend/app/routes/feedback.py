from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.matching import MatchingIndex
from app.models import Feedback, Profile
from app.schemas import FeedbackInput
from app.security import Actor, get_optional_user, identify_actor

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("", status_code=201)
def submit_feedback(payload: FeedbackInput, request: Request, db: Session = Depends(get_db),
                    actor: Actor | None = Depends(get_optional_user),
                    x_bot_key: str | None = Header(default=None),
                    x_telegram_user_id: str | None = Header(default=None)) -> dict[str, object]:
    resolved = identify_actor(actor, x_bot_key, x_telegram_user_id)
    if x_bot_key and resolved is None:
        raise HTTPException(status_code=401, detail="INVALID_BOT_CREDENTIALS|Invalid bot credentials")
    # Public candidate IDs are stable profile IDs; reject feedback for an unknown match.
    profile = db.scalar(select(Profile).where(Profile.public_id == payload.match_id))
    if profile is not None and not profile.is_public:
        profile = None
    index: MatchingIndex = request.app.state.matching_index
    known_in_seed = any(str(item.get("id")) == payload.match_id for item in index.profiles)
    if profile is None and not known_in_seed:
        profile = db.scalar(select(Profile).where(Profile.id == payload.match_id))
    if profile is None and not known_in_seed:
        raise HTTPException(status_code=404, detail="MATCH_TARGET_NOT_FOUND|Match target not found")
    feedback = Feedback(target_id=payload.match_id, rating=payload.rating, comment=payload.comment,
                        score=payload.score, goal=payload.goal,
                        user_id=resolved.user_id if resolved and not resolved.is_bot else None,
                        telegram_user_id=x_telegram_user_id if resolved and resolved.is_bot else None)
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {"id": feedback.id, "status": "saved"}
