import { useI18n } from "../hooks/useI18n";
export function ProgressSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  const { t } = useI18n();
  return (
    <div className="progress-steps">
      <div className="flex justify-between gap-4">
        <span>
          {t("onboarding.step", { step: current + 1, total: steps.length })}
        </span>
        <strong>{Math.round(((current + 1) / steps.length) * 100)}%</strong>
      </div>
      <progress value={current + 1} max={steps.length} />
      <ol>
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={i <= current ? "active" : ""}
          >
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
