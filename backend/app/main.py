from contextlib import asynccontextmanager
from pathlib import Path
from collections.abc import AsyncIterator
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.matching import MatchingIndex
from app.models import Profile
from app.errors import install_error_handlers
from app.routes import feedback, health, match, profile, telegram


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    settings = get_settings()
    profiles_path = Path(settings.profiles_path)
    if not profiles_path.is_absolute():
        profiles_path = Path(__file__).resolve().parents[1] / profiles_path
    index = MatchingIndex.from_file(profiles_path)
    with SessionLocal() as db:
        for saved in db.query(Profile).filter(Profile.is_public.is_(True)).all():
            if not saved.role or not saved.goal:
                continue
            index.replace({
                "id": saved.public_id or saved.id, "user_id": saved.user_id, "name": saved.name, "role": saved.role,
                "goal": saved.goal, "skills": json.loads(saved.skills_json),
                "interests": json.loads(saved.interests_json),
                "experience_years": saved.experience_years, "bio": saved.bio,
                "email": saved.email, "phone": saved.phone, "age": saved.age, "city": saved.city,
            })
    app.state.matching_index = index
    yield


app = FastAPI(title="MeetMatch AI Backend", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
install_error_handlers(app)
app.include_router(health.router)
app.include_router(match.router)
app.include_router(profile.router)
app.include_router(feedback.router)
app.include_router(telegram.router)
