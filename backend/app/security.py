import hmac
from dataclasses import dataclass
from typing import Annotated
import jwt
from fastapi import Depends, Header, HTTPException

from app.config import get_settings


@dataclass(frozen=True)
class Actor:
    user_id: str
    is_bot: bool = False


def _bearer(authorization: str | None) -> Actor | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()
    if not settings.supabase_jwt_secret:
        raise HTTPException(status_code=401, detail="JWT verification is not configured")
    try:
        payload = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub"]}, audience="authenticated")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=401, detail="Token subject is missing")
    return Actor(user_id=subject)


def get_optional_user(authorization: Annotated[str | None, Header()] = None) -> Actor | None:
    actor = _bearer(authorization)
    settings = get_settings()
    if actor is None and settings.env == "dev" and settings.dev_auth_bypass:
        return Actor("dev-user")
    return actor


def require_user(actor: Annotated[Actor | None, Depends(get_optional_user)]) -> Actor:
    if actor is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return actor


def resolve_actor(
    actor: Annotated[Actor | None, Depends(get_optional_user)],
    x_bot_key: Annotated[str | None, Header()] = None,
    x_telegram_user_id: Annotated[str | None, Header()] = None,
) -> Actor:
    resolved = identify_actor(actor, x_bot_key, x_telegram_user_id)
    if resolved is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return resolved


def identify_actor(actor: Actor | None, bot_key: str | None, telegram_user_id: str | None) -> Actor | None:
    if actor is not None:
        return actor
    settings = get_settings()
    if bot_key and telegram_user_id and settings.bot_api_key and hmac.compare_digest(bot_key, settings.bot_api_key):
        return Actor(user_id=f"telegram:{telegram_user_id}", is_bot=True)
    return None
