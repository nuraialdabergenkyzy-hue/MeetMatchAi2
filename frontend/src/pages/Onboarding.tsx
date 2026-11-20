import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { useI18n } from "../hooks/useI18n";
import { useOnboardingDraft } from "../hooks/useOnboardingDraft";
import { useMatches } from "../hooks/useMatches";
import { validateStep, type Errors } from "../lib/validation";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { TagInput } from "../components/TagInput";
import { GoalSelector } from "../components/GoalSelector";
import { ProgressSteps } from "../components/ProgressSteps";
export default function Onboarding() {
  const { t } = useI18n(),
    { draft, update } = useOnboardingDraft(),
    { fetchMatches, status, error } = useMatches(),
    navigate = useNavigate(),
    [step, setStep] = useState(0),
    [errors, setErrors] = useState<Errors>(() => {
      const fields: Errors = {};
      if (error?.status === 422 && Array.isArray(error.detail)) {
        for (const issue of error.detail) {
          const field = Array.isArray(issue?.loc)
            ? issue.loc.find((name: string) => ["role", "experience", "stack", "interests", "about", "goal"].includes(name))
            : undefined;
          if (field) fields[field] = `validation.${field}`;
        }
      }
      return fields;
    });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    const field = Object.keys(errors)[0];
    if (field) setStep(["role", "experience"].includes(field) ? 0 : ["stack", "interests"].includes(field) ? 1 : field === "about" ? 2 : 3);
  }, []);
  const steps = [1, 2, 3, 4].map((n) => t(`onboarding.step${n}.title`));
  function next() {
    const e = validateStep(draft, step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    const invalid = [0, 1, 2, 3].find(
      (s) => Object.keys(validateStep(draft, s)).length,
    );
    if (invalid !== undefined) {
      setStep(invalid);
      setErrors(validateStep(draft, invalid));
      return;
    }
    void fetchMatches(draft);
    navigate("/matches");
  }
  return (
    <section className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">MeetMatch AI</span>
        <h1>{t("onboarding.title")}</h1>
        <p className="muted">{t("onboarding.subtitle")}</p>
      </div>
      <ProgressSteps steps={steps} current={step} />
      <form
        className="card form-card"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        noValidate
      >
        <h2 ref={heading} tabIndex={-1}>{steps[step]}</h2>
        <div key={step} className="step-content">
          {step === 0 && (
            <>
              <Input
                label={t("field.role")}
                placeholder={t("field.role.placeholder")}
                value={draft.role}
                maxLength={80}
                onChange={(e) => update({ role: e.target.value })}
                error={errors.role && t(errors.role)}
              />
              <div className="experience-field">
                <Input
                  type="number"
                  min={0}
                  max={60}
                  step="any"
                  label={t("field.experience")}
                  value={Number.isNaN(draft.experience) ? "" : draft.experience}
                  onChange={(e) =>
                    update({
                      experience:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                  error={errors.experience && t(errors.experience)}
                />
                <div className="actions">
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`${t("field.experience")} −1`}
                    disabled={draft.experience <= 0}
                    onClick={() =>
                      update({
                        experience: Math.max(0, (draft.experience || 0) - 1),
                      })
                    }
                  >
                    <Minus size={18} />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`${t("field.experience")} +1`}
                    disabled={draft.experience >= 60}
                    onClick={() =>
                      update({
                        experience: Math.min(60, (draft.experience || 0) + 1),
                      })
                    }
                  >
                    <Plus size={18} />
                  </Button>
                </div>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <TagInput
                label={t("field.stack")}
                value={draft.stack}
                onChange={(stack) => update({ stack })}
                max={15}
                error={errors.stack && t(errors.stack)}
                suggestions={[
                  "React",
                  "Python",
                  "AI",
                  "Design",
                  "DevOps",
                  "Data",
                ]}
              />
              <TagInput
                label={t("field.interests")}
                value={draft.interests}
                onChange={(interests) => update({ interests })}
                max={10}
                error={errors.interests && t(errors.interests)}
                suggestions={["Startups", "Product", "AI", "Design", "Data"]}
              />
            </>
          )}
          {step === 2 && (
            <>
              <Textarea
                label={t("field.about")}
                placeholder={t("field.about.placeholder")}
                rows={7}
                value={draft.about}
                maxLength={500}
                onChange={(e) => update({ about: e.target.value })}
                error={errors.about && t(errors.about)}
              />
              <p className="hint text-right">{draft.about.length}/500</p>
            </>
          )}
          {step === 3 && (
            <>
              <GoalSelector
                value={draft.goal}
                onChange={(goal) => update({ goal })}
              />
              {errors.goal && <p className="error-text">{t(errors.goal)}</p>}
            </>
          )}
        </div>
        <div aria-live="polite" className="sr-only">
          {Object.values(errors)
            .map((e) => t(e))
            .join(" ")}
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={step === 0}
            onClick={() => {
              setErrors({});
              setStep(step - 1);
            }}
          >
            {t("common.back")}
          </Button>
          <Button type="submit" loading={status === "loading"}>
            {t(step === 3 ? "onboarding.submit" : "common.next")}
          </Button>
        </div>
      </form>
    </section>
  );
}
