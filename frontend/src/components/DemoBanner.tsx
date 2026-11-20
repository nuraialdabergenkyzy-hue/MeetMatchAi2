import { Info } from "lucide-react";
import { useI18n } from "../hooks/useI18n";
export function DemoBanner({ reason }: { reason: "auth" | "api" }) {
  const { t } = useI18n();
  return (
    <div className="demo-banner">
      <Info size={16} />
      <span>{t(reason === "api" ? "demo.api" : "demo.banner")}</span>
    </div>
  );
}
