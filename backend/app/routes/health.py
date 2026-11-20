from fastapi import APIRouter, Request
from sqlalchemy import text

from app.database import engine

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health(request: Request) -> dict[str, object]:
    database = "ok"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database = "error"
    index = getattr(request.app.state, "matching_index", None)
    return {"status": "ok" if database == "ok" else "degraded", "version": request.app.version,
            "candidates_loaded": len(index.profiles) if index else 0, "database": database}
