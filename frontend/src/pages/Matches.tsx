import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMatches } from "../hooks/useMatches";
import { useOnboardingDraft } from "../hooks/useOnboardingDraft";
import { useI18n } from "../hooks/useI18n";
import { validDraft } from "../lib/validation";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { MatchCard } from "../components/MatchCard";
import { DemoBanner } from "../components/DemoBanner";
import { Button } from "../components/ui/Button";
export default function Matches() {
  const m = useMatches(),
    { draft } = useOnboardingDraft(),
    { t } = useI18n(),
    navigate = useNavigate();
  useEffect(() => {
    if (m.status === "idle") {
      if (validDraft(draft)) void m.fetchMatches(draft);
      else navigate("/onboarding", { replace: true });
    }
  }, [m.status]);
  return (
    <section className="page container">
      <div className="page-heading">
        <span className="eyebrow">MeetMatch AI</span>
        <h1>{t("matches.title")}</h1>
        {m.processingMs !== undefined && m.status !== "loading" && (
          <p className="muted">
            {t("matches.processing", { ms: m.processingMs })}
          </p>
        )}
      </div>
      {m.isDemo && <DemoBanner reason="api" />}
      {m.status === "loading" || m.status === "idle" ? (
        <LoadingState variant="matches" />
      ) : m.status === "error" ? (
        <>
          <ErrorState
            message={t(m.error?.message ?? "errors.generic")}
            onRetry={() => void m.fetchMatches(draft)}
            actions={
              <Link className="btn btn-secondary" to="/onboarding">
                {t("matches.edit")}
              </Link>
            }
          />
          {m.error?.status === 422 && Array.isArray(m.error.detail) && (
            <ul className="error-text">
              {m.error.detail.map((item, i) => {
                const field = Array.isArray(item.loc)
                  ? item.loc.find((k: string) =>
                      [
                        "role",
                        "stack",
                        "experience",
                        "interests",
                        "about",
                        "goal",
                      ].includes(k),
                    )
                  : null;
                return field ? (
                  <li key={i}>
                    {t(`field.${field}`)}: {t(`validation.${field}`)}
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </>
      ) : m.status === "empty" ? (
        <EmptyState />
      ) : (
        <>
          {m.status === "partial" && (
            <p className="notice" role="status">
              {t("matches.partial", { count: m.matches.length })}
            </p>
          )}
          {m.rejected && (
            <div className="notice actions" role="status">
              {t("matches.refreshPrompt")}
              <Button
                variant="secondary"
                onClick={() => void m.fetchMatches(draft)}
              >
                {t("matches.refresh")}
              </Button>
            </div>
          )}
          <div className="match-grid">
            {m.matches.map((match, i) => (
              <MatchCard
                key={match.id}
                match={match}
                index={i}
                status={m.cards[match.id] ?? "idle"}
                onFeedback={m.sendFeedback}
              />
            ))}
          </div>
        </>
      )}
      {!["loading", "idle"].includes(m.status) && (
        <div className="actions mt-8">
          <Button onClick={() => void m.fetchMatches(draft)}>
            {t("matches.refresh")}
          </Button>
          <Link className="btn btn-secondary" to="/onboarding">
            {t("matches.edit")}
          </Link>
        </div>
      )}
    </section>
  );
}
