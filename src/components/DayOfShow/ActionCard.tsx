import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string | null;
  sub?: string | null;
  /** Show the navigate arrow on the right edge — used for the venue card */
  showNavArrow?: boolean;
  href?: string;
  onClick?: () => void;
  /** Render the title in mono (used for the guest-list count) */
  titleMono?: boolean;
  /** "muted" gives the card a slightly different bg, used for the navigate row */
  variant?: "default" | "muted";
  /** Stretch to full width row instead of grid cell */
  fullWidth?: boolean;
  className?: string;
}

/**
 * Tappable card used in the Phase 1 action grid (DOS contact, guest list,
 * venue navigate). Renders as `<a>` when an `href` is given, otherwise a
 * `<button>`. Falls back to a non-interactive `<div>` when neither is
 * provided (purely informational tile).
 */
export default function ActionCard({
  icon: Icon,
  eyebrow,
  title,
  sub,
  showNavArrow,
  href,
  onClick,
  titleMono,
  variant = "default",
  fullWidth,
  className,
}: ActionCardProps) {
  const interactive = !!(href || onClick);

  const inner = (
    <>
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 inline-flex items-center justify-center rounded-[9px] h-8 w-8"
          style={{
            background: "hsl(var(--secondary))",
            color: "hsl(var(--foreground))",
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[9.5px] uppercase font-medium leading-none mb-1.5"
            style={{ letterSpacing: "0.14em", color: "hsl(var(--muted-foreground))" }}
          >
            {eyebrow}
          </div>
          <div
            className={cn(
              "font-medium leading-[1.25] truncate",
              fullWidth ? "text-[14px]" : "text-[13.5px]",
              titleMono && "font-mono",
            )}
            style={{ color: "hsl(var(--foreground))" }}
          >
            {title || "—"}
          </div>
          {sub && (
            <div
              className="text-[11.5px] leading-[1.35] mt-1 truncate"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {sub}
            </div>
          )}
        </div>
        {showNavArrow && (
          <ArrowUpRight
            className="h-4 w-4 shrink-0 mt-0.5"
            style={{ color: "hsl(var(--muted-foreground))" }}
          />
        )}
      </div>
    </>
  );

  const sharedClass = cn(
    "block w-full text-left rounded-[12px] border p-[12px_14px] min-h-[100px]",
    interactive &&
      "[transition:transform_160ms_var(--ease-out),background-color_160ms_var(--ease-out)] active:scale-[0.98]",
    className,
  );
  const sharedStyle = {
    background: variant === "muted" ? "hsl(var(--muted) / 0.5)" : "hsl(var(--card))",
    borderColor: "hsl(var(--border))",
  } as const;

  if (href) {
    return (
      <a href={href} className={sharedClass} style={sharedStyle}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={sharedClass} style={sharedStyle}>
        {inner}
      </button>
    );
  }
  return (
    <div className={sharedClass} style={sharedStyle}>
      {inner}
    </div>
  );
}
