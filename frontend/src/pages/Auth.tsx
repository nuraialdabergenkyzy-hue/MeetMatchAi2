import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { authError } from "../contexts/AuthContext";
import { useI18n } from "../hooks/useI18n";
import { emailValid, passwordValid, type Errors } from "../lib/validation";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/LoadingState";
import { api } from "../services/api";
export function DemoAuth() {
  const { t } = useI18n();
  return (
    <section className="page narrow">
      <div className="card state-box">
        <ShieldCheck />
        <h1>{t("nav.login")}</h1>
        <p>{t("demo.auth")}</p>
        <Link to="/onboarding" className="btn btn-primary">
          {t("home.hero.cta")}
        </Link>
      </div>
    </section>
  );
}
export function AuthForm({ register = false }: { register?: boolean }) {
  const auth = useAuth(),
    { t } = useI18n(),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [errors, setErrors] = useState<Errors>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    navigate = useNavigate(),
    location = useLocation();
  if (!auth.isConfigured) return <DemoAuth />;
  if (auth.loading) return <LoadingState />;
  if (auth.session && !busy) return <Navigate to="/dashboard" replace />;
  async function submit() {
    const e: Errors = {};
    if (!emailValid(email)) e.email = "validation.email";
    if (register ? !passwordValid(password) : !password)
      e.password = "validation.password";
    if (register && confirm !== password) e.confirm = "validation.confirm";
    setErrors(e);
    if (Object.keys(e).length || busy) return;
    setBusy(true);
    setError("");
    try {
      if (register) {
        await auth.signUp(email.trim(), password);
        setPassword("");
        setConfirm("");
        navigate("/verify-email", { state: { email: email.trim() } });
      } else {
        await auth.signIn(email.trim(), password);
        setPassword("");
        let complete = false;
        try {
          const p = await api.getProfile();
          complete = Boolean(p?.personal?.full_name);
        } catch {
          /* recover via profile setup */
        }
        const from = location.state?.from;
        navigate(
          complete
            ? typeof from === "string" &&
              from.startsWith("/") &&
              !from.startsWith("//")
              ? from
              : "/dashboard"
            : "/profile/setup",
          { replace: true },
        );
      }
    } catch (e) {
      setError(authError(e));
      setPassword("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page auth-page">
      <div className="page-heading">
        <span className="eyebrow">MeetMatch AI</span>
        <h1>{t(register ? "nav.signup" : "nav.login")}</h1>
        <p className="muted">{t("auth.intro")}</p>
      </div>
      <form
        className="card form-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t("field.email")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email && t(errors.email)}
        />
        <Input
          label={t("field.password")}
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password && t(errors.password)}
        />
        {register && (
          <Input
            label={t("field.confirm")}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm && t(errors.confirm)}
          />
        )}
        <div aria-live="polite">
          {error && <p className="error-text">{t(error)}</p>}
          {error === "auth.unconfirmed" && (
            <Link
              className="btn btn-secondary"
              to="/verify-email"
              state={{ email }}
            >
              {t("auth.resend")}
            </Link>
          )}
        </div>
        <Button type="submit" loading={busy}>
          {t(register ? "nav.signup" : "nav.login")}
        </Button>
        <Link
          className="text-accent text-center"
          to={register ? "/login" : "/register"}
        >
          {t(register ? "nav.login" : "nav.signup")}
        </Link>
      </form>
    </section>
  );
}
export function VerifyEmail() {
  const auth = useAuth(),
    { t } = useI18n(),
    location = useLocation(),
    [email, setEmail] = useState(
      location.state?.email ?? auth.user?.email ?? "",
    ),
    [busy, setBusy] = useState(false),
    [remaining, setRemaining] = useState(0),
    [sent, setSent] = useState(Boolean(location.state?.email)),
    [error, setError] = useState(
      location.hash.includes("error") || location.search.includes("error")
        ? "auth.expired"
        : "",
    );
  useEffect(() => {
    if (!remaining) return;
    const id = setTimeout(() => setRemaining((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);
  if (!auth.isConfigured) return <DemoAuth />;
  if (auth.loading) return <LoadingState />;
  return (
    <section className="page auth-page">
      <div className="card form-card">
        <MailCheck className="text-accent" size={38} />
        <h1>
          {t(auth.user?.email_confirmed_at ? "auth.verified" : "auth.verify")}
        </h1>
        {auth.user?.email_confirmed_at ? (
          <>
            <p className="text-success">{t("common.confirmed")}</p>
            <Link to="/profile/setup" className="btn btn-primary">
              {t("common.continue")}
            </Link>
          </>
        ) : (
          <>
            <p className="muted">
              {sent ? t("auth.sent", { email }) : t("auth.unconfirmed")}
            </p>
            <Input
              label={t("field.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p role="alert" className="error-text">
                {t(error)}
              </p>
            )}
            <Button
              disabled={remaining > 0}
              loading={busy}
              onClick={async () => {
                if (!emailValid(email)) {
                  setError("validation.email");
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  await auth.resendConfirmation(email.trim());
                  setRemaining(60);
                  setSent(true);
                } catch (e) {
                  setError(authError(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {remaining
                ? t("auth.cooldown", { seconds: remaining })
                : t("auth.resend")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
