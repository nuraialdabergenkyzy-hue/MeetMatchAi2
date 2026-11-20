import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translations, type Key } from "./translations";
import type { Lang } from "../types";
const I18n = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}>(null!);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const l = localStorage.getItem("meetmatch.lang");
      return l === "en" || l === "kk" ? l : "ru";
    } catch {
      return "ru";
    }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("meetmatch.lang", lang);
    } catch {
      /* private storage */
    }
  }, [lang]);
  const t = (key: string, params: Record<string, string | number> = {}) =>
    Object.entries(params).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      translations[lang][key as Key] ?? translations.ru[key as Key] ?? key,
    );
  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
