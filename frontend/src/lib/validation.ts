import { GOALS, type MatchRequest, type PersonalProfile } from "../types";
export type Errors = Record<string, string>;
const length = (v: string, min: number, max: number) =>
  v.trim().length >= min && v.trim().length <= max;
export const emailValid = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const passwordValid = (v: string) =>
  v.length >= 8 && /\p{L}/u.test(v) && /\d/.test(v);
export function validatePersonal(p: PersonalProfile): Errors {
  const e: Errors = {};
  if (!length(p.full_name, 2, 100)) e.full_name = "validation.name";
  if (!Number.isInteger(p.age) || p.age < 16 || p.age > 100)
    e.age = "validation.age";
  if (!length(p.city, 2, 80)) e.city = "validation.city";
  if (!/^\+[1-9]\d{7,14}$/.test(p.phone.replace(/[\s()-]/g, "")))
    e.phone = "validation.phone";
  return e;
}
export const emptyDraft: MatchRequest = {
  role: "",
  experience: 0,
  stack: [],
  interests: [],
  about: "",
  goal: "" as MatchRequest["goal"],
};
export const normalizeRequest = (p: MatchRequest): MatchRequest => ({
  role: p.role.trim(),
  experience: Number(p.experience),
  stack: normalizeTags(p.stack),
  interests: normalizeTags(p.interests),
  about: p.about.trim(),
  goal: p.goal,
});
export function normalizeTags(tags: string[]) {
  return tags
    .map((t) => t.trim())
    .filter(
      (t, i, a) =>
        t && a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i,
    );
}
export function validateStep(p: MatchRequest, step: number): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!length(p.role, 2, 80)) e.role = "validation.role";
    if (!Number.isFinite(p.experience) || p.experience < 0 || p.experience > 60)
      e.experience = "validation.experience";
  }
  if (step === 1)
    for (const [key, max] of [
      ["stack", 15],
      ["interests", 10],
    ] as const) {
      if (
        !p[key].length ||
        p[key].length > max ||
        p[key].some((t) => !length(t, 1, 30))
      )
        e[key] = `validation.${key}`;
    }
  if (step === 2 && !length(p.about, 10, 500)) e.about = "validation.about";
  if (step === 3 && !GOALS.includes(p.goal)) e.goal = "validation.goal";
  return e;
}
export const validDraft = (p: MatchRequest) =>
  [0, 1, 2, 3].every((s) => Object.keys(validateStep(p, s)).length === 0);
