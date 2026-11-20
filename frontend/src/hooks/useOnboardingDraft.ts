import { useSyncExternalStore } from "react";
import type { MatchRequest } from "../types";
import { emptyDraft, validateStep } from "../lib/validation";
const key = "meetmatch.onboarding.draft";
function read(): MatchRequest {
  try {
    const d = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return d &&
      typeof d.role === "string" &&
      typeof d.about === "string" &&
      typeof d.experience === "number" &&
      Array.isArray(d.stack) &&
      d.stack.every((v: unknown) => typeof v === "string") &&
      Array.isArray(d.interests) &&
      d.interests.every((v: unknown) => typeof v === "string")
      ? { ...emptyDraft, ...d }
      : { ...emptyDraft };
  } catch {
    return { ...emptyDraft };
  }
}
let draft = read();
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}
export function clearDraft() {
  draft = { ...emptyDraft };
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
  emit();
}
export function useOnboardingDraft() {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => draft,
  );
  return {
    draft: value,
    update: (patch: Partial<MatchRequest>) => {
      draft = { ...draft, ...patch };
      try {
        sessionStorage.setItem(key, JSON.stringify(draft));
      } catch {
        /* keep in memory */
      }
      emit();
    },
    clear: clearDraft,
    isValidStep: (n: number) => !Object.keys(validateStep(value, n)).length,
  };
}
