import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { LuminaProvider } from "@/app/LuminaProvider";
import { BrandGlyph } from "@/components/luminax/BrandMark";
import { LuminaCursor } from "@/components/luminax/LuminaCursor";
import { LuminaShell } from "@/components/luminax/LuminaShell";

const LandingPage = lazy(() => import("@/features/landing/LandingPage"));
const AdminLoginPage = lazy(() => import("@/features/admin/AdminLoginPage"));
const SetupPage = lazy(() => import("@/features/setup/SetupPage"));
const AccessHubPage = lazy(() => import("@/features/hub/AccessHubPage"));
const ReaderPage = lazy(() => import("@/features/modules/ReaderPage"));
const MediaPage = lazy(() => import("@/features/modules/MediaPage"));
const CommunicationPage = lazy(() => import("@/features/modules/CommunicationPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const ControlLabPage = lazy(() => import("@/features/settings/ControlLabPage"));
const PrivacyPage = lazy(() => import("@/features/settings/PrivacyPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function InitializationScreen() {
  return (
    <div className="initialization-screen" role="status" aria-live="polite">
      <BrandGlyph />
      <p>Preparing LuminaXR</p>
      <div><span>Loading interface</span><i /></div>
      <small>Accessibility controls are becoming ready</small>
    </div>
  );
}

class LuminaErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LuminaXR recovered from a page error", error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="error-boundary">
        <BrandGlyph />
        <p>THIS EXPERIENCE NEEDS A RESET</p>
        <h1>LuminaXR is still available.</h1>
        <span>A module encountered a problem. Return to the Access Hub to continue safely.</span>
        <a href="/hub">Return to Access Hub</a>
      </main>
    );
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LuminaProvider>
            <LuminaErrorBoundary>
              <Suspense fallback={<InitializationScreen />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/admin" element={<AdminLoginPage />} />
                  <Route path="/access" element={<SetupPage />} />
                  <Route path="/calibrate" element={<Navigate to="/access" replace />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route element={<LuminaShell />}>
                    <Route path="/hub" element={<AccessHubPage />} />
                    <Route path="/read" element={<ReaderPage />} />
                    <Route path="/media" element={<MediaPage />} />
                    <Route path="/communicate" element={<CommunicationPage />} />
                    <Route path="/routines" element={<Navigate to="/hub" replace />} />
                    <Route path="/wellbeing" element={<Navigate to="/hub" replace />} />
                    <Route path="/civic" element={<Navigate to="/hub" replace />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/control-lab" element={<ControlLabPage />} />
                  </Route>
                  <Route path="/reading" element={<Navigate to="/read" replace />} />
                  <Route path="/vote" element={<Navigate to="/hub" replace />} />
                  <Route path="/welfare" element={<Navigate to="/communicate" replace />} />
                  <Route path="/demo" element={<Navigate to="/hub" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <LuminaCursor />
            </LuminaErrorBoundary>
          </LuminaProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
