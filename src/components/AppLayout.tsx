import { NavLink, Outlet } from "react-router-dom";
import { Calendar, Users, FolderOpen, Settings, LogOut, Moon, Sun, FileText } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Calendar, label: "Home" },
  { to: "/shows", icon: FileText, label: "All Shows" },
  { to: "/tours", icon: FolderOpen, label: "Tours" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function AppLayout() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* Desktop top nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm hidden md:block">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <NavLink to="/" className="font-display text-xl tracking-tight text-foreground">
              Advance
            </NavLink>
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="text-muted-foreground hover:text-foreground gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile top bar — minimal with logo + utility buttons */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <NavLink to="/" className="font-display text-lg tracking-tight text-foreground">
            Advance
          </NavLink>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-4 md:py-8 px-4 md:px-8">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden safe-area-bottom">
        <div className="flex items-stretch justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-3 flex-1 text-[11px] font-medium transition-colors min-h-[52px]",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
