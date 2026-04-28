import { cn } from "@/lib/utils";

interface LedgerRuleProps {
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function LedgerRule({ children, right, className }: LedgerRuleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 pb-1.5 mb-2.5 border-b border-foreground/80",
        className,
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground">
        {children}
      </span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}
