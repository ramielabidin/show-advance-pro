import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface GuestLayoutProps {
  children: React.ReactNode;
}

export default function GuestLayout({ children }: GuestLayoutProps) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="px-4 sm:px-8 pt-6 flex items-center justify-between">
        <p className="font-display text-xl tracking-[-0.02em] text-foreground">Advance</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 [transition:transform_150ms_var(--ease-out),opacity_150ms_var(--ease-out)] dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 [transition:transform_150ms_var(--ease-out),opacity_150ms_var(--ease-out)] dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </header>
      <main className="px-4 sm:px-8 pt-8 pb-20 animate-fade-in">
        <div className="mx-auto w-full max-w-[880px] min-w-0">{children}</div>
      </main>
      <footer className="px-4 sm:px-8 pb-8">
        <p className="mx-auto w-full max-w-[880px] text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">
          Powered by Advance
        </p>
      </footer>
    </div>
  );
}
