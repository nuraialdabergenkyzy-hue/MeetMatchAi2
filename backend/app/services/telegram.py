import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import Profile, TelegramLink

_failed_attempts: dict[str, list[datetime]] = {}


def issue_code(db: Session, user_id: str) -> tuple[str, datetime]:
    db.query(TelegramLink).filter(TelegramLink.user_id == user_id).delete()
    raw = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
    link = TelegramLink(user_id=user_id, code_hash=hashlib.sha256(raw.encode()).hexdigest(), code_prefix=raw[:4], expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10), attempts=0)
    db.add(link)
    db.commit()
    return f"{raw[:4]}-{raw[4:]}", link.expires_at.replace(tzinfo=timezone.utc)


def confirm_code(db: Session, code: str, telegram_user_id: str, telegram_username: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    attempts = [item for item in _failed_attempts.get(telegram_user_id, []) if now - item < timedelta(minutes=10)]
    _failed_attempts[telegram_user_id] = attempts
    if len(attempts) >= 5:
        raise HTTPException(status_code=429, detail="RATE_LIMITED|Too many attempts; try again later")
    normalized = code.replace("-", "").upper()
    if len(normalized) != 8:
        _failed_attempts[telegram_user_id].append(now)
        raise HTTPException(status_code=400, detail="LINK_CODE_INVALID|Invalid or expired link code")
    digest = hashlib.sha256(normalized.encode()).hexdigest()
    link = db.scalar(select(TelegramLink).where(TelegramLink.code_hash == digest))
    if link is None:
        _failed_attempts[telegram_user_id].append(now)
        raise HTTPException(status_code=400, detail="LINK_CODE_INVALID|Invalid or expired link code")
    if link.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        db.delete(link)
        db.commit()
        _failed_attempts[telegram_user_id].append(now)
        raise HTTPException(status_code=400, detail="LINK_CODE_INVALID|Invalid or expired link code")
    profile = db.scalar(select(Profile).where(Profile.user_id == link.user_id))
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    existing = db.scalar(select(Profile).where(Profile.telegram_user_id == telegram_user_id))
    if existing is not None and existing.user_id != profile.user_id:
        raise HTTPException(status_code=409, detail="TELEGRAM_ALREADY_LINKED|Telegram account is already linked")
    profile.telegram_user_id = telegram_user_id
    profile.telegram_username = telegram_username
    db.delete(link)
    db.commit()
    _failed_attempts.pop(telegram_user_id, None)
    return profile.user_id
