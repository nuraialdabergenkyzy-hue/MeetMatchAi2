import { describe, it, expect } from "vitest";
import {
  emptyDraft,
  validateStep,
  validatePersonal,
  validDraft,
  normalizeRequest,
  emailValid,
  passwordValid,
} from "./validation";
import { GOALS, type MatchRequest } from "../types";
const request: MatchRequest = {
  role: "Developer",
  experience: 2,
  stack: ["React"],
  interests: ["AI"],
  about: "Building helpful products.",
  goal: "find_mentor",
};
describe("onboarding validation", () => {
  it("rejects every empty step", () => {
    for (let i = 0; i < 4; i++)
      expect(Object.keys(validateStep(emptyDraft, i)).length).toBeGreaterThan(
        0,
      );
  });
  it("accepts all six contract goals", () => {
    expect(GOALS).toHaveLength(6);
    for (const goal of GOALS)
      expect(validDraft({ ...request, goal })).toBe(true);
  });
  it("enforces experience and tag boundaries", () => {
    for (const experience of [-1, 61, NaN, Infinity])
      expect(validDraft({ ...request, experience })).toBe(false);
    expect(validDraft({ ...request, experience: 0.5 })).toBe(true);
    expect(validDraft({ ...request, stack: Array(16).fill("React") })).toBe(
      false,
    );
    expect(validDraft({ ...request, interests: ["x".repeat(31)] })).toBe(false);
  });
  it("enforces about and role limits", () => {
    expect(validDraft({ ...request, about: "short" })).toBe(false);
    expect(validDraft({ ...request, about: "x".repeat(501) })).toBe(false);
    expect(validDraft({ ...request, role: "x" })).toBe(false);
  });
  it("normalizes without extra request fields", () => {
    expect(
      normalizeRequest({
        ...request,
        role: " Developer ",
        stack: [" React ", "react", "Python"],
        about: " Building helpful products. ",
      }),
    ).toEqual({ ...request, stack: ["React", "Python"] });
  });
});
describe("personal and authentication validation", () => {
  const profile = {
    full_name: "Mononym",
    age: 16,
    city: "Almaty",
    phone: "+7 700 000 0000",
    gender: null,
    email: "user@example.test",
  };
  it("accepts mononyms and valid lower age limit", () =>
    expect(validatePersonal(profile)).toEqual({}));
  it("rejects invalid age and phone punctuation with too few digits", () => {
    expect(
      validatePersonal({ ...profile, age: 16.5, phone: "----------" }),
    ).toEqual({ age: "validation.age", phone: "validation.phone" });
  });
  it("checks email and password rules", () => {
    expect(emailValid("a@b.kz")).toBe(true);
    expect(emailValid("a@b")).toBe(false);
    expect(passwordValid("secure123")).toBe(true);
    expect(passwordValid("abcdefgh")).toBe(false);
    expect(passwordValid("12345678")).toBe(false);
  });
});
