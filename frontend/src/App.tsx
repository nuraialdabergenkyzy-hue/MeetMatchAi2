import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { DemoBanner } from "./components/DemoBanner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoadingState } from "./components/LoadingState";
import { env, isDemoAuthMode } from "./lib/env";
const Home = lazy(() => import("./pages/Home")),
  Onboarding = lazy(() => import("./pages/Onboarding")),
  Matches = lazy(() => import("./pages/Matches")),
  Login = lazy(() => import("./pages/Login")),
  Register = lazy(() => import("./pages/Register")),
  VerifyEmail = lazy(() => import("./pages/VerifyEmail")),
  ProfileSetup = lazy(() => import("./pages/ProfileSetup")),
  EditProfile = lazy(() => import("./pages/EditProfile")),
  Dashboard = lazy(() => import("./pages/Dashboard")),
  NotFound = lazy(() => import("./pages/NotFound"));
export default function App() {
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    const unauthorized = () =>
      navigate("/login", { replace: true, state: { from: location.pathname } });
    window.addEventListener("meetmatch:unauthorized", unauthorized);
    return () =>
      window.removeEventListener("meetmatch:unauthorized", unauthorized);
  }, [navigate, location.pathname]);
  useEffect(() => {
    if (location.hash) {
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    } else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return (
    <>
      <Navbar />
      {(isDemoAuthMode || env.useMockApi) && (
        <DemoBanner reason={env.useMockApi ? "api" : "auth"} />
      )}
      <main id="main-content">
        <Suspense
          fallback={
            <div className="container">
              <LoadingState />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute allowDemo>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/matches"
              element={
                <ProtectedRoute allowDemo>
                  <Matches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/setup"
              element={
                <ProtectedRoute>
                  <ProfileSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <EditProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
