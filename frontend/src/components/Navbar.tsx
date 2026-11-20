import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Waypoints } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../hooks/useI18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";
export function Navbar() {
  const { t } = useI18n(),
    { session, signOut } = useAuth(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    navigate = useNavigate(),
    toast = useToast();
  return (
    <header className="site-header">
      <nav className="container nav" aria-label="MeetMatch AI">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-icon">
            <Waypoints size={25} />
          </span>
          MeetMatch <span className="text-accent">AI</span>
        </Link>
        <button
          className="icon-button mobile-toggle"
          aria-label={t("nav.menu")}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <div id="main-nav" className={`nav-links ${open ? "open" : ""}`}>
          <a href="/#how-it-works" onClick={() => setOpen(false)}>
            {t("home.how")}
          </a>
          <a href="/#features" onClick={() => setOpen(false)}>
            {t("home.features")}
          </a>
          <LanguageSwitcher />
          {session ? (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                {t("nav.dashboard")}
              </Link>
              <Button
                variant="secondary"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await signOut();
                    setOpen(false);
                    navigate("/");
                  } catch {
                    toast(t("errors.generic"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>
                {t("nav.login")}
              </Link>
              <Link
                to="/register"
                className="btn btn-primary"
                onClick={() => setOpen(false)}
              >
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
