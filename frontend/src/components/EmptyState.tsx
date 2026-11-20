import { UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "../hooks/useI18n";
export function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="card state-box">
      <UsersRound />
      <h2>{t("matches.empty")}</h2>
      <p className="muted">{t("matches.empty.desc")}</p>
      <Link className="btn btn-primary" to="/onboarding">
        {t("matches.edit")}
      </Link>
    </div>
  );
}
