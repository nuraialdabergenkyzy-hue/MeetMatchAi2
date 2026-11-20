#!/usr/bin/env python3
"""Generate a reproducible, entirely synthetic demo candidate set."""
import argparse
import json
import hashlib
from pathlib import Path

GOAL_PROFILES = {
    "find_job": ("Frontend Developer", ["React", "TypeScript", "JavaScript"], ["product", "design systems"]),
    "hire": ("Technical Recruiter", ["React", "TypeScript", "hiring", "talent acquisition"], ["product", "startups"]),
    "find_cofounder": ("Startup Founder", ["product strategy", "MVP", "Python"], ["startups", "AI", "product"]),
    "exchange_experience": ("Angel Investor", ["venture capital", "finance", "SaaS"], ["startups", "AI", "impact"]),
    "find_mentor": ("Product Designer", ["Figma", "product design", "research"], ["design", "startups", "learning"]),
    "be_mentor": ("Product Mentor", ["product strategy", "roadmapping", "leadership"], ["mentoring", "startups", "design"]),
}
FIRST_NAMES = ["Aida", "Daniyar", "Mira", "Arman", "Sofia", "Timur", "Aruzhan", "Nurlan", "Alina", "Dias", "Dana", "Ilyas", "Madina", "Askar", "Karina", "Erlan", "Zarina", "Maksat", "Amina", "Ruslan"]
LAST_NAMES = ["Kim", "Sato", "Lee", "Patel", "Garcia", "Brown", "Chen", "Ivanov", "Khan", "Miller"]


def generate_profiles(seed: int = 42, count_per_goal: int = 30) -> list[dict[str, object]]:
    profiles: list[dict[str, object]] = []
    for goal, (role, skills, interests) in GOAL_PROFILES.items():
        for number in range(count_per_goal):
            skill_list = list(skills)
            interest_list = list(interests)
            pool = ["Python", "SQL", "analytics", "communication", "leadership", "AI", "cloud", "testing", "growth", "fintech", "education", "mobile"]
            pool.sort(key=lambda item: hashlib.sha256(f"{seed}:{goal}:{number}:{item}".encode()).hexdigest())
            skill_list.extend(pool[:2 + number % 3])
            interest_list.extend(["networking", ["AI", "fintech", "education", "climate", "health", "design"][number % 6]])
            profiles.append({
                "id": f"demo-{goal}-{number + 1:03d}",
                "name": f"{FIRST_NAMES[(number + len(profiles)) % len(FIRST_NAMES)]} {LAST_NAMES[(number * 3 + len(profiles)) % len(LAST_NAMES)]}",
                "role": role if number == 0 else f"{role} {['at a startup', 'and operator', 'with SaaS experience', 'in technology'][number % 4]}",
                "goal": goal,
                "skills": skill_list,
                "interests": interest_list,
                "experience_years": 1 + (number * 3 + len(profiles)) % 16,
                "bio": f"{role} interested in {', '.join(interest_list[:2])} and meeting thoughtful people.",
                "email": f"demo{len(profiles) + 1}@example.test",
                "phone": None,
                "age": 22 + (number % 20),
                "city": ["Almaty", "Astana", "Shymkent"][number % 3],
            })
    return profiles


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/profiles.json")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--count-per-goal", type=int, default=30)
    args = parser.parse_args()
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(generate_profiles(args.seed, args.count_per_goal), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
