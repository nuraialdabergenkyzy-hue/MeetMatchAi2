import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { clearDraft } from "../hooks/useOnboardingDraft";
import { clearMockSession } from "../services/mockApi";
function useAuthState() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let observed = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      observed = true;
      if (active) {
        setSession(s);
        setLoading(false);
      }
      if (_event === "SIGNED_OUT") {
        clearDraft();
        clearMockSession();
        window.dispatchEvent(new Event("meetmatch:reset"));
      }
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active && !observed) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return {
    session,
    user: session?.user ?? null,
    loading,
    isConfigured: Boolean(supabase),
    signUp: async (email: string, password: string) => {
      const r = await supabase!.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/verify-email` },
      });
      if (r.error) throw r.error;
      if (r.data.user?.identities?.length === 0)
        throw { code: "user_already_exists" };
    },
    signIn: async (email: string, password: string) => {
      const r = await supabase!.auth.signInWithPassword({ email, password });
      if (r.error) throw r.error;
    },
    signOut: async () => {
      const result = await supabase?.auth.signOut();
      if (result?.error) throw result.error;
      clearDraft();
      clearMockSession();
      window.dispatchEvent(new Event("meetmatch:reset"));
    },
    resendConfirmation: async (email: string) => {
      const r = await supabase!.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${location.origin}/verify-email` },
      });
      if (r.error) throw r.error;
    },
  };
}
const Auth = createContext<ReturnType<typeof useAuthState>>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  return <Auth.Provider value={useAuthState()}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);
export function authError(e: unknown) {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case "invalid_credentials":
      return "auth.invalid";
    case "email_not_confirmed":
      return "auth.unconfirmed";
    case "user_already_exists":
    case "email_exists":
      return "auth.exists";
    case "weak_password":
      return "validation.password";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "auth.rate";
    default:
      return e instanceof TypeError ? "errors.network" : "errors.generic";
  }
}
