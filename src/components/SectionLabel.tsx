import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  incomplete?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export default function SectionLabel({ children, incomplete, action, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-0.5 h-3.5 rounded-full bg-foreground/25 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          {children}
          {incomplete && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--pastel-yellow-fg)]" />}
        </span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
