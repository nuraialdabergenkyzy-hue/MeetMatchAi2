import { useI18n } from "../hooks/useI18n";
import type { Lang } from "../types";
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={t("settings.language")}
    >
      {(["ru", "kk", "en"] as Lang[]).map((l) => (
        <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l === "kk" ? "KZ" : l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
