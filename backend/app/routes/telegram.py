import hmac
from typing import Annotated
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas import TelegramCodeInput
from app.security import Actor, get_optional_user
from app.services.telegram import confirm_code, issue_code

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.post("/link", status_code=201)
def telegram_link(response: Response, payload: dict[str, Any] | None = None,
                  actor: Actor | None = Depends(get_optional_user), db: Session = Depends(get_db),
                  x_bot_key: Annotated[str | None, Header()] = None) -> dict[str, object]:
    settings = get_settings()
    if payload:
        if not x_bot_key or not settings.bot_api_key or not hmac.compare_digest(x_bot_key, settings.bot_api_key):
            raise HTTPException(status_code=401, detail="INVALID_BOT_CREDENTIALS|Invalid bot credentials")
        confirmation = TelegramCodeInput.model_validate(payload)
        user_id = confirm_code(db, confirmation.code, str(confirmation.telegram_user_id), confirmation.telegram_username)
        response.status_code = 200
        return {"linked": True, "user_id": user_id}
    if actor is None:
        raise HTTPException(status_code=401, detail="AUTH_REQUIRED|Authentication required")
    code, expires_at = issue_code(db, actor.user_id)
    username = settings.bot_username.lstrip("@")
    deep_link = f"https://t.me/{username}?start=link_{code}" if username else ""
    return {"code": code, "expires_at": expires_at.isoformat(), "deep_link": deep_link}
