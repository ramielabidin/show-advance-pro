import { cn } from "@/lib/utils";

export type ChipTone = "blue" | "green" | "yellow" | "red" | "muted" | "new";

interface ChipProps {
  children: React.ReactNode;
  tone?: ChipTone;
  className?: string;
}

const TONE_STYLES: Record<ChipTone, React.CSSProperties> = {
  blue: { background: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" },
  green: { background: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
  yellow: { background: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" },
  red: { background: "var(--pastel-red-bg)", color: "var(--pastel-red-fg)" },
  muted: { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
  new: { background: "hsl(var(--badge-new) / 0.15)", color: "hsl(var(--badge-new))" },
};

export default function Chip({ children, tone = "blue", className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0",
        className,
      )}
      style={TONE_STYLES[tone]}
    >
      {children}
    </span>
  );
}
