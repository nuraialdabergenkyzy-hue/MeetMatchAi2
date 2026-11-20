import { Link } from "react-router-dom";
import { useI18n } from "../hooks/useI18n";
export default function NotFound() {
  const { t } = useI18n();
  return (
    <section className="page narrow state-box">
      <span className="eyebrow">404</span>
      <h1>{t("common.notfound")}</h1>
      <Link className="btn btn-primary" to="/">
        {t("common.home")}
      </Link>
    </section>
  );
}
