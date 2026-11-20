import { useI18n } from "../hooks/useI18n";
export function LoadingState({
  variant = "page",
  label,
}: {
  variant?: "page" | "matches";
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite">
      <p className="muted py-6">
        {label ??
          t(variant === "matches" ? "matches.loading" : "common.loading")}
      </p>
      {variant === "matches" && (
        <div className="match-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="card skeleton" aria-hidden="true">
              <div />
              <div />
              <div />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
