import { Link } from "react-router-dom";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "../hooks/useI18n";
export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer container">
      <div>
        <Link className="brand" to="/">
          MeetMatch <span className="text-accent">AI</span>
        </Link>
        <p className="hint mt-3">
          © {new Date().getFullYear()} · {t("home.footer")}
        </p>
      </div>
      <div className="actions">
        <a href="/#how-it-works">{t("home.how")}</a>
        <a href="/#features">{t("home.features")}</a>
        <LanguageSwitcher />
      </div>
    </footer>
  );
}
