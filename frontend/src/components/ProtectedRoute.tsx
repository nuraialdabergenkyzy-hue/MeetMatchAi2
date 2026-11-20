import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isDemoAuthMode } from "../lib/env";
import { LoadingState } from "./LoadingState";
export function ProtectedRoute({
  children,
  allowDemo = false,
}: {
  children: ReactNode;
  allowDemo?: boolean;
}) {
  const { session, loading, user } = useAuth(),
    location = useLocation();
  if (allowDemo && isDemoAuthMode) return children;
  if (loading) return <LoadingState />;
  if (!session)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!user?.email_confirmed_at) return <Navigate to="/verify-email" replace />;
  return children;
}
