from fastapi.testclient import TestClient

from app.main import app
from scripts.generate_profiles import generate_profiles


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["version"] == "1.0.0"
    assert response.json()["candidates_loaded"] >= 150
    assert response.json()["database"] == "ok"


def test_match_errors_use_common_envelope() -> None:
    with TestClient(app) as client:
        response = client.post("/api/match", json={"goal": "unknown", "unexpected": True})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "message" in response.json()["error"]
    assert "details" in response.json()["error"]


def test_match_top5_and_performance() -> None:
    query = {"role": "Frontend Developer", "goal": "find_job", "stack": ["React", "TypeScript"], "interests": ["product"], "experience": 2}
    with TestClient(app) as client:
        response = client.post("/api/match", json=query)
    assert response.status_code == 200
    result = response.json()
    assert len(result["matches"]) == 5
    assert result["processing_ms"] < 3000
    assert result["matches"][0]["goal"] == "hire"


def test_explanations_are_specific_and_private_fields_are_omitted() -> None:
    query = {"role": "Frontend Developer", "goal": "find_job", "stack": ["React", "TypeScript"], "interests": ["product"], "experience": 2}
    with TestClient(app) as client:
        matches = client.post("/api/match", json=query).json()["matches"]
    assert any(skill in matches[0]["reason"].lower() for skill in ("react", "typescript", "product"))
    assert matches[0]["name"] in matches[0]["icebreaker"]
    assert not ({"email", "phone", "age", "city"} & matches[0].keys())


def test_generator_file_matches_seeded_output() -> None:
    import json
    from pathlib import Path

    checked_in = json.loads((Path(__file__).parents[1] / "data" / "profiles.json").read_text(encoding="utf-8"))
    assert checked_in == generate_profiles(seed=42)
