import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { TeamProvider } from "@/components/TeamProvider";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import ShowsPage from "@/pages/ShowsPage";
import ShowDetailPage from "@/pages/ShowDetailPage";
import ToursPage from "@/pages/ToursPage";
import TourDetailPage from "@/pages/TourDetailPage";
import TouringPartyPage from "@/pages/TouringPartyPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

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
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ShowsPage />} />
          <Route path="/shows/:id" element={<ShowDetailPage />} />
          <Route path="/tours" element={<ToursPage />} />
          <Route path="/tours/:id" element={<TourDetailPage />} />
          <Route path="/party" element={<TouringPartyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
