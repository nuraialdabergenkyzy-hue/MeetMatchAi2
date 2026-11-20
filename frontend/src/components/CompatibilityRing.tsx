import { useI18n } from "../hooks/useI18n";
export function CompatibilityRing({
  score,
  size = 76,
}: {
  score: number;
  size?: number;
}) {
  const { t } = useI18n();
  return (
    <div
      className="compatibility-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t("matches.score", { score: Math.round(score) })}
    >
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="#26305A"
          strokeWidth="5"
        />
        <circle
          className="ring-fill"
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          pathLength="100"
          strokeDasharray={`${score} 100`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
      </svg>
      <strong>
        {Math.round(score)}
        <small>%</small>
      </strong>
    </div>
  );
}
