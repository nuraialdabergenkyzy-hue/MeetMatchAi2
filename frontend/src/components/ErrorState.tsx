import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/Button";
import { useI18n } from "../hooks/useI18n";
export function ErrorState({
  message,
  onRetry,
  actions,
}: {
  message: string;
  onRetry?: () => void;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="card state-box" role="alert">
      <AlertCircle className="text-danger" />
      <p>{message}</p>
      <div className="actions">
        {onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>}
        {actions}
      </div>
    </div>
  );
}
