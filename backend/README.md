# MeetMatch AI Backend

FastAPI backend for the MeetMatch conference networking demo. The checked-in candidate dataset is synthetic and must not be presented as real users.

## Quick start

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python scripts/generate_profiles.py --out data/profiles.json
uvicorn app.main:app --reload --port 8000
```

The API listens on port 8000. Swagger docs are at `/docs`; health is `/api/health`. Configure `CORS_ORIGINS` as a comma-separated list. Set `SUPABASE_JWT_SECRET` and `BOT_API_KEY` in `.env` for authenticated routes. `DEV_AUTH_BYPASS` is only effective when `ENV=dev`.

## Examples

```powershell
curl.exe http://localhost:8000/api/health
curl.exe -X POST http://localhost:8000/api/match -H "Content-Type: application/json" -d '{"role":"Frontend Developer","stack":["React","TypeScript"],"experience":2,"interests":["product"],"about":"Looking for an engineering role","goal":"find_job"}'
```

## Matching

Matching is deterministic and runs offline. It normalizes aliases, compares skills/interests, estimates experience proximity, and computes hand-built TF-IDF cosine similarity over role, bio and profile keywords. The weighted score uses 40% skills, 25% interests, 20% experience, and 15% semantic similarity. Results are sorted deterministically and contain explanations and icebreakers based on pair facts.

## Database

SQLite is the default. It stores user profiles, feedback, and one-time Telegram linking codes. Configure the location with `DATABASE_URL`.

The API schemas and examples follow `BACKEND_SPEC.md`, including the six supported goals and nested profile representation.
