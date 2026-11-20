from datetime import datetime, timedelta, timezone
from collections.abc import Generator
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


@pytest.fixture
def credentials(monkeypatch: pytest.MonkeyPatch) -> Generator[tuple[str, str], None, None]:
    secret = "offline-test-secret"
    bot_key = "offline-test-bot-key"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("BOT_API_KEY", bot_key)
    monkeypatch.setenv("ENV", "test")
    get_settings.cache_clear()
    yield secret, bot_key
    get_settings.cache_clear()


def _token(secret: str, user_id: str) -> str:
    return jwt.encode({"sub": user_id, "aud": "authenticated", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, secret, algorithm="HS256")


def test_profile_auth_feedback_and_telegram_link(credentials: tuple[str, str]) -> None:
    secret, bot_key = credentials
    user_id = f"test-{uuid.uuid4()}"
    authorization = {"Authorization": f"Bearer {_token(secret, user_id)}"}
    profile_body = {"personal": {"full_name": "Test Person", "email": "person@example.test"}, "professional": {"role": "Engineer", "goal": "find_job", "stack": ["Python"], "interests": ["AI"], "experience": 3}}
    with TestClient(app) as client:
        assert client.get("/api/profile/me").status_code == 401
        saved = client.put("/api/profile/me", headers=authorization, json=profile_body)
        assert saved.status_code == 200
        assert saved.json()["personal"]["full_name"] == "Test Person"
        assert client.put("/api/profile/me", headers=authorization, json={"personal": {"user_id": "victim"}}).status_code == 422
        match_id = client.post("/api/match", json={"role": "Engineer", "goal": "find_job", "stack": ["Python"], "interests": ["AI"], "experience": 3}).json()["matches"][0]["id"]
        feedback = client.post("/api/feedback", headers=authorization, json={"match_id": match_id, "rating": "like"})
        assert feedback.status_code == 201
        issued = client.post("/api/telegram/link", headers=authorization, json={})
        assert issued.status_code == 201
        code = issued.json()["code"]
        linked = client.post("/api/telegram/link", headers={"X-Bot-Key": bot_key}, json={"code": code, "telegram_user_id": 987654, "telegram_username": "testuser"})
        assert linked.status_code == 200
        assert linked.json() == {"linked": True, "user_id": user_id}


def test_invalid_jwt_is_rejected(credentials: tuple[str, str]) -> None:
    with TestClient(app) as client:
        response = client.get("/api/profile/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert response.status_code == 401
