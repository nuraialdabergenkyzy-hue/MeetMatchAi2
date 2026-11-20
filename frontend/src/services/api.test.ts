import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("./supabase", () => ({ supabase: null }));
import { request, validateMatches } from "./api";
import { demoMatches, mockApi, clearMockSession } from "./mockApi";
import { ApiError, type MatchRequest } from "../types";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("match response contract", () => {
  it("preserves server order, fractional scores and full content", () => {
    const list = [
      { ...demoMatches[1], score: 34.25, reason: "long ".repeat(400) },
      demoMatches[0],
    ];
    expect(validateMatches({ matches: list, processing_ms: 90 })).toEqual({
      matches: list,
      processing_ms: 90,
    });
  });
  it("supports empty, partial, maximum-five and absent timing", () => {
    expect(validateMatches({ matches: [] })).toEqual({ matches: [] });
    expect(
      validateMatches({ matches: demoMatches.slice(0, 2) }).matches,
    ).toHaveLength(2);
    expect(
      validateMatches({ matches: [...demoMatches, ...demoMatches] }).matches,
    ).toHaveLength(5);
  });
  it("rejects malformed envelopes and wholly invalid nonempty arrays", () => {
    for (const value of [
      null,
      {},
      [],
      { matches: null },
      { matches: [{ score: 101 }] },
    ])
      expect(() => validateMatches(value)).toThrow(ApiError);
  });
  it("drops invalid entries and timing without replacing scores", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      validateMatches({
        matches: [demoMatches[0], { ...demoMatches[1], score: NaN }],
        processing_ms: -5,
      }),
    ).toEqual({ matches: [demoMatches[0]] });
    warn.mockRestore();
  });
});
describe("HTTP behavior", () => {
  it("posts the exact body and omits Authorization without a session", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetch);
    const body = { match_id: "demo-a", action: "met" };
    await request("/api/feedback", { method: "POST", body });
    expect(fetch).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  it("preserves FastAPI validation details without raw UI messages", async () => {
    const detail = [
      { loc: ["body", "role"], msg: "internal validation detail" },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail }), { status: 422 }),
        ),
    );
    await expect(request("/api/match")).rejects.toMatchObject({
      status: 422,
      message: "errors.validation",
      detail,
    });
  });
  it("maps network and server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(request("/api/health")).rejects.toMatchObject({
      status: 0,
      message: "errors.network",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
    );
    await expect(request("/api/health")).rejects.toMatchObject({
      status: 503,
      message: "errors.server",
    });
  });
  it("aborts on timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      ),
    );
    const promise = expect(
      request("/api/match", { timeout: 10000 }),
    ).rejects.toMatchObject({ status: 0 });
    await vi.advanceTimersByTimeAsync(10000);
    await promise;
  });
});
describe("honest demo API", () => {
  it("returns the same fixed results regardless of the request and no invented timing", async () => {
    vi.useFakeTimers();
    const a = mockApi.match({} as MatchRequest),
      b = mockApi.match({ role: "different" } as MatchRequest);
    await vi.advanceTimersByTimeAsync(600);
    expect(await a).toEqual(await b);
    expect(await a).toMatchObject({ __demo: true });
    expect(await a).not.toHaveProperty("processing_ms");
  });
  it("keeps personal data in memory and clears it on logout", async () => {
    vi.useFakeTimers();
    const update = mockApi.updateProfile({ email: "demo@example.test" });
    await vi.advanceTimersByTimeAsync(600);
    await update;
    clearMockSession();
    const get = mockApi.getProfile();
    await vi.advanceTimersByTimeAsync(600);
    expect(await get).toEqual({});
  });
});
