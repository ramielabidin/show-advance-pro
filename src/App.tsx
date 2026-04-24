import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { TeamProvider } from "@/components/TeamProvider";
import { PendingEmailsProvider } from "@/components/PendingEmailsProvider";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ShowsPage from "@/pages/ShowsPage";
import ShowDetailPage from "@/pages/ShowDetailPage";
import GuestShowPage from "@/pages/GuestShowPage";
import InvitePage from "@/pages/InvitePage";

import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";

function ToursRedirect() {
  useEffect(() => {
    console.info("[deprecation] /tours now redirects to /shows?view=tour");
  }, []);
  return <Navigate to="/shows?view=tour" replace />;
}

function TourDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    console.info(`[deprecation] /tours/${id} now redirects to /shows?view=tour&tourId=${id}`);
  }, [id]);
  return <Navigate to={`/shows?view=tour&tourId=${id}`} replace />;
}

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <TeamProvider>
      <PendingEmailsProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/shows" element={<ShowsPage />} />
            <Route path="/shows/:id" element={<ShowDetailPage />} />
            <Route path="/tours" element={<ToursRedirect />} />
            <Route path="/tours/:id" element={<TourDetailRedirect />} />

            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PendingEmailsProvider>
    </TeamProvider>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAUpdatePrompt />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/guest/:token" element={<GuestShowPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
