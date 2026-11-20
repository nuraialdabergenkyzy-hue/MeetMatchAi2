import json
import math
import re
from pathlib import Path
from typing import Any

ALIASES = {
    "js": "javascript",
    "ts": "typescript",
    "reactjs": "react",
    "py": "python",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "pm": "product management",
}
SKILL_GROUPS = (
    {"javascript", "typescript", "react", "vue", "angular", "frontend"},
    {"python", "fastapi", "django", "backend"},
    {"machine learning", "artificial intelligence", "data science"},
    {"product management", "product strategy", "roadmapping"},
    {"sales", "business development", "partnerships"},
)
STRICT_PAIRS = {
    "find_job": {"hire"},
    "hire": {"find_job"},
    "find_mentor": {"be_mentor"},
    "be_mentor": {"find_mentor"},
    "find_cofounder": {"find_cofounder"},
    "exchange_experience": {"exchange_experience"},
}
TOKEN_RE = re.compile(r"[a-z0-9+#.]+", re.I)


def normalize(value: str) -> str:
    return " ".join(ALIASES.get(token, token) for token in TOKEN_RE.findall(value.casefold()))


def _items(profile: dict[str, Any], key: str) -> set[str]:
    raw = profile.get(key, [])
    if not isinstance(raw, list):
        return set()
    return {normalize(str(value)) for value in raw if str(value).strip()}


def _expanded(values: set[str]) -> set[str]:
    expanded = set(values)
    for group in SKILL_GROUPS:
        if expanded & group:
            expanded.update(group)
    return expanded


def _jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 0.0


def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
    dot = sum(weight * right.get(term, 0.0) for term, weight in left.items())
    left_norm = math.sqrt(sum(weight * weight for weight in left.values()))
    right_norm = math.sqrt(sum(weight * weight for weight in right.values()))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0


def _tfidf(texts: list[str]) -> list[dict[str, float]]:
    docs = [normalize(text).split() for text in texts]
    df: dict[str, int] = {}
    for terms in docs:
        for term in set(terms):
            df[term] = df.get(term, 0) + 1
    vectors: list[dict[str, float]] = []
    count = max(1, len(docs))
    for terms in docs:
        frequencies: dict[str, int] = {}
        for term in terms:
            frequencies[term] = frequencies.get(term, 0) + 1
        vectors.append({term: (1.0 + math.log(freq)) * (math.log((1 + count) / (1 + df[term])) + 1) for term, freq in frequencies.items()})
    return vectors


class MatchingIndex:
    def __init__(self, profiles: list[dict[str, Any]]) -> None:
        self.profiles = [dict(profile) for profile in profiles]

    @classmethod
    def from_file(cls, path: str | Path) -> "MatchingIndex":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError("Profiles file must contain a JSON array")
        return cls(data)

    def replace(self, profile: dict[str, Any]) -> None:
        profile_id = str(profile["id"])
        self.profiles = [item for item in self.profiles if str(item.get("id")) != profile_id]
        self.profiles.append(dict(profile))

    def remove(self, profile_id: str) -> None:
        self.profiles = [item for item in self.profiles if str(item.get("id")) != str(profile_id)]

    def match(self, seeker: dict[str, Any], limit: int = 5) -> tuple[list[dict[str, Any]], int, bool]:
        goal = str(seeker.get("goal", ""))
        blocked = {str(seeker.get("id", "")), str(seeker.get("user_id", ""))}
        candidates = [p for p in self.profiles if str(p.get("id", "")) not in blocked and p.get("user_id") not in blocked]
        compatible_targets = STRICT_PAIRS.get(goal, set())
        compatible = [p for p in candidates if p.get("goal") in compatible_targets]
        strict_ids = {str(p.get("id", "")) for p in compatible}
        fallback_candidates = []
        if len(compatible) < limit:
            fallback_candidates = [p for p in candidates if p.get("goal") == "exchange_experience" and goal != "exchange_experience"]
            if goal not in {"be_mentor", "hire", "find_job"}:
                fallback_candidates += [p for p in candidates if p.get("goal") == "find_cofounder" and str(p.get("id", "")) not in strict_ids]
            compatible_ids = strict_ids
            compatible += [p for p in fallback_candidates if str(p.get("id", "")) not in compatible_ids]
        query_text = " ".join([str(seeker.get("role", "")), str(seeker.get("bio", "")), *map(str, seeker.get("skills", [])), *map(str, seeker.get("interests", []))])
        scored: list[tuple[float, float, str, dict[str, Any], set[str], set[str], bool]] = []
        texts = [query_text] + [" ".join([str(p.get("role", "")), str(p.get("bio", "")), *map(str, p.get("skills", [])), *map(str, p.get("interests", []))]) for p in compatible]
        vectors = _tfidf(texts)
        seeker_skills = _expanded(_items(seeker, "skills"))
        seeker_interests = _items(seeker, "interests")
        seeker_years = max(0, int(seeker.get("experience_years", 0) or 0))
        for offset, candidate in enumerate(compatible, start=1):
            skills = _expanded(_items(candidate, "skills"))
            interests = _items(candidate, "interests")
            years = max(0, int(candidate.get("experience_years", 0) or 0))
            skill_score = _jaccard(seeker_skills, skills)
            interest_score = _jaccard(seeker_interests, interests)
            experience_score = max(0.0, 1.0 - abs(seeker_years - years) / max(3, seeker_years, years))
            semantic_score = _cosine(vectors[0], vectors[offset])
            base = 0.40 * skill_score + 0.25 * interest_score + 0.20 * experience_score + 0.15 * semantic_score
            is_fallback = str(candidate.get("id", "")) not in strict_ids
            score = 100 * base * (0.75 if is_fallback else 1.0)
            if is_fallback and score < 10:
                continue
            actual_shared_skills = _items(seeker, "skills") & _items(candidate, "skills")
            scored.append((score, base, str(candidate.get("id", "")), candidate, actual_shared_skills, seeker_interests & interests, is_fallback))
        scored.sort(key=lambda row: (-row[0], -row[1], row[2]))
        fallback_used = any(row[6] for row in scored[:limit])
        results: list[dict[str, Any]] = []
        for score, _base, _candidate_id, candidate, common_skills, common_interests, _is_fallback in scored[:limit]:
            facts = sorted(common_skills or common_interests)
            if facts:
                reason = "Shared " + ("skills" if common_skills else "interests") + ": " + ", ".join(facts[:3]) + "."
            else:
                reason = f"Goal compatibility: {goal} pairs with {candidate.get('goal')}; role and experience are considered."
            topic = facts[0] if facts else str(candidate.get("role", "your work"))
            name = str(candidate.get("name", "there"))
            results.append({"id": str(candidate.get("id", "")), "name": name, "role": str(candidate.get("role", "")), "score": round(score), "goal": str(candidate.get("goal", "")), "reason": reason, "icebreaker": f"Hi {name}, I noticed our connection around {topic}. What are you working on at the conference?"})
        return results, len(candidates), fallback_used
