import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, type MatchResult } from "../services/api";
import { normalizeRequest } from "../lib/validation";
import type {
  MatchRequest,
  MatchesStatus,
  MatchCardStatus,
  FeedbackAction,
} from "../types";
function useMatchesState() {
  const [status, setStatus] = useState<MatchesStatus>("idle"),
    [result, setResult] = useState<MatchResult>({ matches: [] }),
    [error, setError] = useState<ApiError | null>(null),
    [cards, setCards] = useState<Record<string, MatchCardStatus>>({}),
    [rejected, setRejected] = useState(false);
  const busy = useRef(false),
    generation = useRef(0),
    sending = useRef(new Set<string>());
  const reset = () => {
    generation.current++;
    busy.current = false;
    sending.current.clear();
    setStatus("idle");
    setResult({ matches: [] });
    setError(null);
    setCards({});
    setRejected(false);
  };
  useEffect(() => {
    window.addEventListener("meetmatch:reset", reset);
    return () => window.removeEventListener("meetmatch:reset", reset);
  }, []);
  async function fetchMatches(p: MatchRequest) {
    if (busy.current) return;
    busy.current = true;
    const run = ++generation.current;
    setStatus("loading");
    setError(null);
    setCards({});
    setRejected(false);
    sending.current.clear();
    try {
      const r = await api.match(normalizeRequest(p));
      if (run !== generation.current) return;
      setResult(r);
      setStatus(
        r.matches.length === 0
          ? "empty"
          : r.matches.length < 5
            ? "partial"
            : "success",
      );
    } catch (e) {
      if (run !== generation.current) return;
      setError(e instanceof ApiError ? e : new ApiError(0, "errors.network"));
      setStatus("error");
    } finally {
      if (run === generation.current) busy.current = false;
    }
  }
  async function sendFeedback(id: string, action: FeedbackAction) {
    if (
      sending.current.has(id) ||
      cards[id] === "met" ||
      cards[id] === "rejected"
    )
      return;
    const run = generation.current;
    sending.current.add(id);
    setCards((c) => ({ ...c, [id]: "sending" }));
    try {
      await api.feedback({ match_id: id, action });
      if (run !== generation.current) return;
      setCards((c) => ({ ...c, [id]: action === "met" ? "met" : "rejected" }));
      if (action === "not_fit") setRejected(true);
    } catch (e) {
      if (run === generation.current) setCards((c) => ({ ...c, [id]: "idle" }));
      throw e;
    } finally {
      sending.current.delete(id);
    }
  }
  return {
    status,
    matches: result.matches,
    processingMs: result.processing_ms,
    isDemo: result.__demo ?? false,
    error,
    fetchMatches,
    sendFeedback,
    reset,
    cards,
    rejected,
  };
}
const Matches = createContext<ReturnType<typeof useMatchesState>>(null!);
export function MatchesProvider({ children }: { children: ReactNode }) {
  return (
    <Matches.Provider value={useMatchesState()}>{children}</Matches.Provider>
  );
}
export const useMatches = () => useContext(Matches);
