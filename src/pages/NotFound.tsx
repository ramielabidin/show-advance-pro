import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 animate-fade-in">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Error 404
        </p>
        <h1 className="font-display text-6xl tracking-[-0.03em] text-foreground">Not found</h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-block text-sm underline underline-offset-2 text-foreground [transition:color_150ms_var(--ease-out)] hover:text-foreground/70"
        >
          Return home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
