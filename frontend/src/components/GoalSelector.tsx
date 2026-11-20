import { GOALS, type Goal } from "../types";
import { goalIcons } from "../lib/goals";
import { useI18n } from "../hooks/useI18n";
import { Check } from "lucide-react";
export function GoalSelector({
  value,
  onChange,
}: {
  value: Goal | null;
  onChange: (goal: Goal) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="goal-grid" role="radiogroup" aria-label={t("field.goal")}>
      {GOALS.map((g, i) => {
        const Icon = goalIcons[g];
        return (
          <button
            type="button"
            key={g}
            role="radio"
            aria-checked={value === g}
            tabIndex={value ? (value === g ? 0 : -1) : i === 0 ? 0 : -1}
            className={`goal-card ${value === g ? "selected" : ""}`}
            onClick={() => onChange(g)}
            onKeyDown={(e) => {
              if (
                [
                  "ArrowRight",
                  "ArrowDown",
                  "ArrowLeft",
                  "ArrowUp",
                  "Home",
                  "End",
                ].includes(e.key)
              ) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 5
                      : (i +
                          (["ArrowLeft", "ArrowUp"].includes(e.key) ? 5 : 1)) %
                        6;
                onChange(GOALS[next]);
                (
                  e.currentTarget.parentElement?.children[next] as HTMLElement
                )?.focus();
              }
            }}
          >
            <span className="goal-icon">
              <Icon size={23} />
              {value === g && <Check size={16} />}
            </span>
            <strong>{t(`goals.${g}.title`)}</strong>
            <span>{t(`goals.${g}.desc`)}</span>
          </button>
        );
      })}
    </div>
  );
}
