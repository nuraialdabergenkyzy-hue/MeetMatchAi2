import { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageCircle, ThumbsUp, X } from "lucide-react";
import type { FeedbackAction, Match, MatchCardStatus } from "../types";
import { useI18n } from "../hooks/useI18n";
import { useToast } from "./ui/Toast";
import { Button } from "./ui/Button";
import { CompatibilityRing } from "./CompatibilityRing";
export function MatchCard({
  match,
  status = "idle",
  onFeedback,
  variant = "live",
  index = 0,
}: {
  match: Match;
  status?: MatchCardStatus;
  onFeedback?: (id: string, action: FeedbackAction) => Promise<void>;
  variant?: "live" | "sample";
  index?: number;
}) {
  const { t } = useI18n(),
    toast = useToast(),
    [copied, setCopied] = useState(false),
    quote = useRef<HTMLParagraphElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    let success = false;
    try {
      await navigator.clipboard.writeText(match.icebreaker);
      success = true;
    } catch {
      const area = document.createElement("textarea");
      area.value = match.icebreaker;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      try {
        success = document.execCommand("copy");
      } catch {
        /* fall through to manual */
      } finally {
        area.remove();
      }
    }
    if (success) {
      setCopied(true);
      toast(t("matches.copied"));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } else {
      if (quote.current) {
        const range = document.createRange();
        range.selectNodeContents(quote.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
      toast(t("matches.manual"));
    }
  }
  async function feedback(action: FeedbackAction) {
    try {
      await onFeedback?.(match.id, action);
      toast(t("matches.marked"));
    } catch {
      toast(t("errors.request"));
    }
  }
  return (
    <article
      className={`card match-card ${status === "rejected" ? "rejected" : ""}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {variant === "sample" && (
        <span className="badge sample-badge">{t("home.sample")}</span>
      )}
      <div className="match-head">
        <div className="avatar" aria-hidden="true">
          {match.name
            .split(/\s+/)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <h3>{match.name}</h3>
          <p className="muted">{match.role}</p>
        </div>
        <CompatibilityRing score={match.score} />
      </div>
      <span className="badge">{t(`goals.${match.goal}.title`)}</span>
      <div className="reason">
        <h4>{t("matches.reason")}</h4>
        <p>{match.reason}</p>
      </div>
      <div className="icebreaker">
        <h4>
          <MessageCircle size={16} />
          {t("matches.icebreaker")}
        </h4>
        <p ref={quote}>{match.icebreaker}</p>
        {variant === "live" && (
          <Button variant="ghost" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
            {t(copied ? "matches.copied" : "matches.copy")}
          </Button>
        )}
      </div>
      {variant === "live" && (
        <div className="feedback-actions">
          {status === "met" || status === "rejected" ? (
            <span className={status === "met" ? "text-success" : "muted"}>
              <Check size={16} />
              {t(status === "met" ? "matches.marked" : "matches.notFit")}
            </span>
          ) : (
            <>
              <Button
                variant="secondary"
                loading={status === "sending"}
                disabled={status !== "idle"}
                onClick={() => feedback("met")}
              >
                <ThumbsUp size={16} />
                {t("matches.met")}
              </Button>
              <Button
                variant="ghost"
                disabled={status !== "idle"}
                onClick={() => feedback("not_fit")}
              >
                <X size={16} />
                {t("matches.notFit")}
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
