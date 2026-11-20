from app.matching import MatchingIndex
from scripts.generate_profiles import generate_profiles


def test_generator_has_180_profiles_and_all_goals() -> None:
    profiles = generate_profiles(seed=42)
    assert len(profiles) == 180
    assert {profile["goal"] for profile in profiles} == {"find_job", "hire", "find_cofounder", "exchange_experience", "find_mentor", "be_mentor"}


def test_find_job_returns_five_hiring_matches_without_private_fields() -> None:
    index = MatchingIndex(generate_profiles())
    query = {"id": "query", "name": "Alex", "role": "Frontend Developer", "goal": "find_job", "skills": ["React", "TypeScript"], "interests": ["product"], "experience_years": 2}
    matches, total, fallback = index.match(query)
    assert len(matches) == 5
    assert matches[0]["goal"] == "hire"
    assert total == 180
    assert not fallback
    assert all(not ({"email", "phone", "age", "city"} & match.keys()) for match in matches)


def test_matching_is_deterministic_and_explanations_use_names() -> None:
    index = MatchingIndex(generate_profiles())
    query = {"id": "query", "name": "Alex", "role": "Frontend Developer", "goal": "find_job", "skills": ["React", "TypeScript"], "interests": ["product"], "experience_years": 2}
    first, _, _ = index.match(query)
    second, _, _ = index.match(query)
    assert first == second
    assert "Shared" in first[0]["reason"]
    assert first[0]["name"] in first[0]["icebreaker"]


def test_all_goals_have_five_strict_matches() -> None:
    index = MatchingIndex(generate_profiles())
    for goal in ("find_job", "hire", "find_cofounder", "exchange_experience", "find_mentor", "be_mentor"):
        matches, _, _ = index.match({"id": "query", "goal": goal})
        assert len(matches) == 5
