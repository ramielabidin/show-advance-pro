import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatTileTone = "blue" | "green" | "yellow" | "red";

interface StatTileProps {
  icon: LucideIcon;
  tone?: StatTileTone;
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const TONE_STYLES: Record<StatTileTone, { bg: string; fg: string }> = {
  blue: { bg: "var(--pastel-blue-bg)", fg: "var(--pastel-blue-fg)" },
  green: { bg: "var(--pastel-green-bg)", fg: "var(--pastel-green-fg)" },
  yellow: { bg: "var(--pastel-yellow-bg)", fg: "var(--pastel-yellow-fg)" },
  red: { bg: "var(--pastel-red-bg)", fg: "var(--pastel-red-fg)" },
};

export default function StatTile({ icon: Icon, tone = "blue", label, value, onClick, className }: StatTileProps) {
  const toneStyle = TONE_STYLES[tone];
  const interactive = typeof onClick === "function";

  const content = (
    <>
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md shrink-0"
          style={{ background: toneStyle.bg, color: toneStyle.fg }}
        >
          <Icon className="h-[13px] w-[13px]" strokeWidth={1.75} />
        </span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-muted-foreground leading-[1.1]">
          {label}
        </span>
      </div>
      <div className="font-display text-3xl tracking-[-0.03em] leading-none text-foreground">
        {value}
      </div>
    </>
  );

  const baseClasses = cn(
    "rounded-[10px] border border-border bg-card px-4 py-3.5 text-left",
    interactive && "cursor-pointer transition-colors hover:border-foreground/20",
    className,
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={cn(baseClasses, "w-full")}>
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
