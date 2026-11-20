import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../services/api";
import type { ProfileMe } from "../types";
import { useI18n } from "../hooks/useI18n";
import { ProfileForm } from "../components/ProfileForm";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/ui/Toast";
export function Profile({ edit = false }: { edit?: boolean }) {
  const { t } = useI18n(),
    navigate = useNavigate(),
    toast = useToast(),
    [profile, setProfile] = useState<ProfileMe | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .getProfile()
      .then((p) => {
        if (active) setProfile(p ?? {});
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) setProfile({});
        else setError(e instanceof ApiError ? e.message : "errors.generic");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">
          {t(edit ? "common.edit" : "profile.progress")}
        </span>
        <h1>{t("profile.title")}</h1>
      </div>
      {loading ? (
        <LoadingState />
      ) : error && !profile ? (
        <ErrorState message={t(error)} onRetry={() => setRetry((v) => v + 1)} />
      ) : (
        <>
          {error && (
            <p role="alert" className="error-text mb-4">
              {t(error)}
            </p>
          )}
          <ProfileForm
            initial={profile?.personal}
            loading={saving}
            submitLabel={t(edit ? "common.save" : "common.continue")}
            onSubmit={async (personal) => {
              setSaving(true);
              setError("");
              try {
                await api.updateProfile({ personal });
                toast(t("common.saved"));
                navigate(edit ? "/dashboard" : "/onboarding");
                return true;
              } catch (e) {
                setError(e instanceof ApiError ? e.message : "errors.generic");
                return false;
              } finally {
                setSaving(false);
              }
            }}
          />
        </>
      )}
    </section>
  );
}
