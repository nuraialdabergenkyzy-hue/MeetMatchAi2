import { useEffect, useState } from "react";
import type { PersonalProfile, Gender } from "../types";
import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import { validatePersonal, type Errors } from "../lib/validation";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
export function ProfileForm({
  initial,
  onSubmit,
  loading,
  submitLabel,
}: {
  initial?: PersonalProfile;
  onSubmit: (p: PersonalProfile) => Promise<boolean>;
  loading: boolean;
  submitLabel: string;
}) {
  const { t } = useI18n(),
    { user } = useAuth(),
    [p, setP] = useState<PersonalProfile>(
      initial ?? {
        full_name: "",
        age: NaN,
        city: "",
        phone: "",
        email: initial?.email ?? user?.email ?? "",
        gender: "undisclosed",
      },
    ),
    [errors, setErrors] = useState<Errors>({}),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const listener = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  const update = (patch: Partial<PersonalProfile>) => {
    setP((v) => ({ ...v, ...patch }));
    setDirty(true);
  };
  return (
    <form
      className="card form-card"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const errors = validatePersonal(p);
        setErrors(errors);
        if (Object.keys(errors).length || loading) return;
        const saved = await onSubmit({
          ...p,
          full_name: p.full_name.trim(),
          city: p.city.trim(),
          phone: p.phone.replace(/[\s()-]/g, "").trim(),
        });
        if (saved) setDirty(false);
      }}
    >
      <Input
        label={t("field.full_name")}
        autoComplete="name"
        value={p.full_name}
        maxLength={100}
        onChange={(e) => update({ full_name: e.target.value })}
        error={errors.full_name && t(errors.full_name)}
      />
      <div className="two-grid">
        <Input
          label={t("field.age")}
          type="number"
          min={16}
          max={100}
          value={Number.isNaN(p.age) ? "" : p.age}
          onChange={(e) =>
            update({
              age: e.target.value === "" ? NaN : Number(e.target.value),
            })
          }
          error={errors.age && t(errors.age)}
        />
        <Select
          label={t("field.gender")}
          value={p.gender ?? "undisclosed"}
          onChange={(e) => update({ gender: e.target.value as Gender })}
        >
          {(["undisclosed", "male", "female", "other"] as const).map((g) => (
            <option key={g} value={g}>
              {t(`gender.${g}`)}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label={t("field.city")}
        autoComplete="address-level2"
        value={p.city}
        maxLength={80}
        onChange={(e) => update({ city: e.target.value })}
        error={errors.city && t(errors.city)}
      />
      <Input
        label={t("field.email")}
        type="email"
        value={user?.email ?? ""}
        readOnly
      />
      {user?.email_confirmed_at && (
        <span className="text-success">{t("common.confirmed")}</span>
      )}
      <Input
        label={t("field.phone")}
        type="tel"
        autoComplete="tel"
        value={p.phone}
        maxLength={18}
        placeholder="+7 700 000 0000"
        onChange={(e) => update({ phone: e.target.value })}
        error={errors.phone && t(errors.phone)}
      />
      <p className="hint">{t("profile.privacy")}</p>
      <div className="sr-only" aria-live="polite">
        {Object.values(errors)
          .map((e) => t(e))
          .join(" ")}
      </div>
      <Button loading={loading} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
