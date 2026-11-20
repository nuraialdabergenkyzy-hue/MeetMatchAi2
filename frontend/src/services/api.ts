import { env } from "../lib/env";
import {
  GOALS,
  ApiError,
  type Match,
  type MatchRequest,
  type FeedbackRequest,
  type FeedbackResponse,
  type ProfileMe,
  type HealthResponse,
  type TelegramLinkResponse,
  type MatchResult,
  type Goal,
} from "../types";
import { mockApi } from "./mockApi";
import { supabase } from "./supabase";
export { ApiError };
export type { MatchResult } from "../types";

const normalizeGoal = (g: string): Goal => {
  if (g === "offer_mentorship") return "be_mentor";
  if (g === "find_investor") return "exchange_experience";
  return g as Goal;
};

export function validateMatches(data: unknown): MatchResult {
  if (
    !data ||
    typeof data !== "object" ||
    !("matches" in data) ||
    !Array.isArray(data.matches)
  )
    throw new ApiError(502, "errors.invalid");
  const matches = data.matches.filter((m: unknown): m is Match => {
    const p = m as Match | null;
    if (p && typeof p.goal === "string") {
      p.goal = normalizeGoal(p.goal);
    }
    const valid =
      p &&
      ["id", "name", "role", "reason", "icebreaker"].every(
        (k) =>
          typeof p[k as keyof Match] === "string" &&
          String(p[k as keyof Match]).trim().length > 0,
      ) &&
      typeof p.score === "number" &&
      Number.isFinite(p.score) &&
      p.score >= 0 &&
      p.score <= 100 &&
      GOALS.includes(p.goal);
    if (!valid) console.warn("Discarded invalid match response item");
    return Boolean(valid);
  });
  if (data.matches.length && !matches.length)
    throw new ApiError(502, "errors.invalid");
  const ms = "processing_ms" in data ? data.processing_ms : undefined;
  return {
    matches: matches.slice(0, 5),
    ...(typeof ms === "number" && Number.isFinite(ms) && ms >= 0
      ? { processing_ms: ms }
      : {}),
  };
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; timeout?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 15000);
  try {
    const session = supabase
      ? (await supabase.auth.getSession()).data.session
      : null;
    const res = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await supabase?.auth.signOut();
        window.dispatchEvent(new Event("meetmatch:unauthorized"));
      }
      const detail =
        data?.detail ?? data?.error?.details ?? data?.error?.message;
      throw new ApiError(
        res.status,
        res.status >= 500
          ? "errors.server"
          : res.status === 401 || res.status === 403
            ? "errors.auth"
            : res.status === 422
              ? "errors.validation"
              : "errors.request",
        detail,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "errors.network");
  } finally {
    clearTimeout(timer);
  }
}

const realApi = {
  health: () => request<HealthResponse>("/api/health"),
  match: async (p: MatchRequest) => {
    const body = {
      role: p.role,
      stack: p.stack ?? [],
      experience: Number(p.experience ?? 0),
      interests: p.interests ?? [],
      about: p.about ?? "",
      goal: p.goal,
    };
    return validateMatches(
      await request<unknown>("/api/match", {
        method: "POST",
        body,
        timeout: 10000,
      }),
    );
  },
  feedback: async (p: FeedbackRequest) => {
    const rating = p.action === "met" ? "contacted" : "dislike";
    const r = await request<FeedbackResponse>("/api/feedback", {
      method: "POST",
      body: {
        match_id: p.match_id,
        rating,
        ...(p.comment ? { comment: p.comment } : {}),
        ...(p.score !== undefined ? { score: p.score } : {}),
        ...(p.goal ? { goal: p.goal } : {}),
      },
    });
    if (!r || !Number.isInteger(r.id) || r.status !== "saved")
      throw new ApiError(502, "errors.invalid");
    return r;
  },
  getProfile: async (): Promise<ProfileMe> => {
    let p: any;
    try {
      p = await request<ProfileMe>("/api/profile/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return {};
      throw error;
    }
    if (!p) return {};
    return apiProfileToUi(p);
  },
  updateProfile: async (p: Partial<ProfileMe>): Promise<ProfileMe> => {
    const personal = p.personal
      ? { ...p.personal, email: p.personal.email || p.email }
      : p.email
        ? { email: p.email }
        : undefined;
    const body = {
      ...(personal ? { personal } : {}),
      ...(p.professional ? { professional: p.professional } : {}),
      ...(p.is_public !== undefined ? { is_public: p.is_public } : {}),
    };
    const saved = await request<ProfileMe>("/api/profile/me", {
      method: "PUT",
      body,
    });
    return apiProfileToUi(saved);
  },
  linkTelegram: async (): Promise<TelegramLinkResponse> => {
    const r = await request<{
      code: string;
      expires_at?: string;
      deep_link?: string;
    }>("/api/telegram/link", { method: "POST" });
    return {
      code: r.code,
      expires_at: r.expires_at,
      expires_in: r.expires_at
        ? Math.max(0, Math.floor((Date.parse(r.expires_at) - Date.now()) / 1000))
        : undefined,
      deep_link: r.deep_link,
    };
  },
};

function apiProfileToUi(p: any): ProfileMe {
  return {
    user_id: p.user_id,
    public_id: p.public_id,
    email: p.personal?.email ?? p.email,
    personal: {
      full_name: p.personal?.full_name ?? p.name ?? "",
      age: p.personal?.age ?? p.age ?? 20,
      city: p.personal?.city ?? p.city ?? "",
      phone: p.personal?.phone ?? p.phone ?? "",
      email: p.personal?.email ?? p.email ?? "",
      gender: p.personal?.gender ?? p.gender ?? null,
    },
    professional: {
      role: p.professional?.role ?? p.role ?? "",
      stack: p.professional?.stack ?? p.skills ?? [],
      experience: p.professional?.experience ?? p.experience_years ?? 0,
      interests: p.professional?.interests ?? p.interests ?? [],
      about: p.professional?.about ?? p.bio ?? "",
      goal: normalizeGoal(p.professional?.goal ?? p.goal ?? "find_job"),
    },
    is_public: p.is_public,
    telegram_linked: p.telegram_linked,
    updated_at: p.updated_at,
    stats: p.stats,
  };
}
export const api = env.useMockApi ? mockApi : realApi;
