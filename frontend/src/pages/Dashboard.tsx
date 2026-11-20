import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Send,
  UserRound,
  FileText,
  UsersRound,
  Target,
  Settings,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../hooks/useI18n";
import { useOnboardingDraft } from "../hooks/useOnboardingDraft";
import { useMatches } from "../hooks/useMatches";
import { api, ApiError } from "../services/api";
import { supabase } from "../services/supabase";
import { env } from "../lib/env";
import { validDraft, passwordValid } from "../lib/validation";
import type { Goal, ProfileMe, TelegramLinkResponse } from "../types";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { GoalSelector } from "../components/GoalSelector";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { authError } from "../contexts/AuthContext";
const sections = [
  "profile",
  "professional",
  "matches",
  "goal",
  "settings",
  "telegram",
] as const;
const icons = [UserRound, FileText, UsersRound, Target, Settings, Send];
export default function Dashboard() {
  const { t } = useI18n(),
    { user, signOut } = useAuth(),
    { draft, update } = useOnboardingDraft(),
    matches = useMatches(),
    toast = useToast(),
    navigate = useNavigate(),
    [tab, setTab] = useState<(typeof sections)[number]>("profile"),
    [profile, setProfile] = useState<ProfileMe | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [goal, setGoal] = useState<Goal>(draft.goal),
    [busy, setBusy] = useState(false),
    [telegram, setTelegram] = useState<TelegramLinkResponse | null>(null),
    [soon, setSoon] = useState(env.useMockApi),
    [seconds, setSeconds] = useState<number | null>(null),
    [password, setPassword] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .getProfile()
      .then((p) => {
        if (active) {
          setProfile(p ?? {});
          if (p?.professional && !validDraft(draft)) {
            update(p.professional);
            setGoal(p.professional.goal);
          }
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof ApiError ? e.message : "errors.generic");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    if (seconds === null || seconds <= 0) return;
    const id = setTimeout(
      () => setSeconds((s) => (s === null ? null : s - 1)),
      1000,
    );
    return () => clearTimeout(id);
  }, [seconds]);
  const missing = ["full_name", "age", "city", "phone"].filter(
    (k) => !profile?.personal?.[k as keyof NonNullable<ProfileMe["personal"]>],
  );
  const percent = Math.round(((4 - missing.length) / 4) * 100);
  function rematch(newGoal?: Goal) {
    const p = { ...draft, ...(newGoal ? { goal: newGoal } : {}) };
    if (newGoal) update({ goal: newGoal });
    if (!validDraft(p)) {
      navigate("/onboarding");
      return;
    }
    void matches.fetchMatches(p);
    navigate("/matches");
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(t(e instanceof ApiError ? e.message : authError(e)));
    } finally {
      setBusy(false);
    }
  }
  const safeLink =
    telegram?.deep_link &&
    /^https:\/\/t\.me\/[\w]+\?start=[\w-]+$/.test(telegram.deep_link)
      ? telegram.deep_link
      : undefined;
  return (
    <section className="page container">
      <div className="page-heading">
        <h1>{t("nav.dashboard")}</h1>
        <p className="muted">{user?.email}</p>
      </div>
      <div className="dashboard-layout">
        <nav className="dashboard-nav" aria-label={t("nav.dashboard")}>
          {sections.map((s, i) => {
            const Icon = icons[i];
            return (
              <button
                key={s}
                className={tab === s ? "active" : ""}
                aria-current={tab === s ? "page" : undefined}
                onClick={() => {
                  setTab(s);
                  setPassword("");
                }}
              >
                <Icon size={19} />
                {t(`dashboard.${s}`)}
              </button>
            );
          })}
        </nav>
        <div className="dashboard-content">
          {tab === "profile" &&
            (loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState
                message={t(error)}
                onRetry={() => setRetry((n) => n + 1)}
              />
            ) : (
              <div className="card form-card">
                <h2>{t("dashboard.profile")}</h2>
                <strong>{t("profile.incomplete", { percent })}</strong>
                <progress max={100} value={percent} />
                {missing.length > 0 && (
                  <p className="muted">
                    {t("profile.missing", {
                      fields: missing.map((k) => t(`field.${k}`)).join(", "),
                    })}
                  </p>
                )}
                {profile?.personal ? (
                  <dl>
                    {Object.entries(profile.personal).map(([key, value]) => (
                      <div key={key}>
                        <dt>{t(`field.${key}`)}</dt>
                        <dd>
                          {key === "gender"
                            ? t(`gender.${value ?? "undisclosed"}`)
                            : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p>{t("dashboard.noProfile")}</p>
                )}
                <p>
                  {user?.email}{" "}
                  {user?.email_confirmed_at && (
                    <span className="badge">{t("common.confirmed")}</span>
                  )}
                </p>
                <Link className="btn btn-secondary" to="/profile/edit">
                  {t("common.edit")}
                </Link>
              </div>
            ))}
          {tab === "professional" && (
            <div className="card form-card">
              <h2>{t("dashboard.professional")}</h2>
              <dl>
                {Object.entries(draft).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(`field.${key}`)}</dt>
                    <dd>
                      {key === "goal" && value
                        ? t(`goals.${value}.title`)
                        : Array.isArray(value)
                          ? value.join(", ")
                          : String(value || "—")}
                    </dd>
                  </div>
                ))}
              </dl>
              <Link className="btn btn-primary" to="/onboarding">
                {t("matches.edit")}
              </Link>
            </div>
          )}
          {tab === "matches" && (
            <div className="card form-card">
              <h2>{t("dashboard.matches")}</h2>
              {matches.matches.map((m) => (
                <div key={m.id} className="summary-match">
                  <strong>{m.name}</strong>
                  <span>
                    {m.role} · {Math.round(m.score)}%
                  </span>
                </div>
              ))}
              {matches.matches.length > 0 && (
                <Link className="btn btn-secondary" to="/matches">
                  {t("matches.title")}
                </Link>
              )}
              <Button onClick={() => rematch()}>
                {t("onboarding.submit")}
              </Button>
            </div>
          )}
          {tab === "goal" && (
            <div className="card form-card">
              <h2>{t("dashboard.goal")}</h2>
              <GoalSelector value={goal} onChange={setGoal} />
              <Button disabled={!goal} onClick={() => rematch(goal)}>
                {t("dashboard.saveMatch")}
              </Button>
            </div>
          )}
          {tab === "settings" && (
            <div className="card form-card">
              <h2>{t("dashboard.settings")}</h2>
              <p>{t("settings.language")}</p>
              <LanguageSwitcher />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!passwordValid(password)) {
                    toast(t("validation.password"));
                    return;
                  }
                  void action(async () => {
                    const { error } = await supabase!.auth.updateUser({
                      password,
                    });
                    setPassword("");
                    if (error) throw error;
                    toast(t("common.saved"));
                  });
                }}
              >
                <Input
                  label={t("settings.password")}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  loading={busy}
                  className="mt-4"
                >
                  {t("settings.passwordSave")}
                </Button>
              </form>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void action(async () => {
                    await signOut();
                    navigate("/");
                  })
                }
              >
                {t("nav.logout")}
              </Button>
            </div>
          )}
          {tab === "telegram" && (
            <div className="card form-card">
              <Send size={32} className="text-accent" />
              <h2>{t("dashboard.telegram")}</h2>
              {soon ? (
                <>
                  <span className="badge">{t("common.soon")}</span>
                  <p className="muted">{t("telegram.soon")}</p>
                </>
              ) : (
                <>
                  {telegram && (
                    <>
                      <p>{t("telegram.desc")}</p>
                      {seconds === 0 ? (
                        <p>{t("telegram.expired")}</p>
                      ) : (
                        <>
                          <code className="telegram-code">{telegram.code}</code>
                          {seconds !== null && (
                            <p>{t("telegram.expires", { seconds })}</p>
                          )}
                          {safeLink && (
                            <a
                              className="btn btn-secondary"
                              target="_blank"
                              rel="noopener noreferrer"
                              href={safeLink}
                            >
                              {t("telegram.open")}
                            </a>
                          )}
                        </>
                      )}
                    </>
                  )}
                  <Button
                    loading={busy}
                    onClick={() =>
                      void action(async () => {
                        try {
                          const result = await api.linkTelegram();
                          if (!result?.code || typeof result.code !== "string")
                            throw new ApiError(502, "errors.invalid");
                          setTelegram(result);
                          setSeconds(
                            typeof result.expires_in === "number"
                              ? Math.max(0, Math.floor(result.expires_in))
                              : null,
                          );
                        } catch (e) {
                          if (
                            e instanceof ApiError &&
                            [0, 404, 501].includes(e.status)
                          ) {
                            setSoon(true);
                            return;
                          }
                          throw e;
                        }
                      })
                    }
                  >
                    {t("dashboard.telegram")}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
