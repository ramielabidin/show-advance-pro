import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  incomplete?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export default function FieldGroup({
  title,
  children,
  className,
  contentClassName,
  incomplete,
  collapsible,
  defaultOpen = true,
}: FieldGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  const header = (
    <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
      {title}
      {incomplete && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--pastel-yellow-fg)]" />}
    </h3>
  );

  if (collapsible) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 mb-3 w-full text-left group"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/60 group-hover:text-foreground [transition:transform_160ms_var(--ease-out),color_150ms_var(--ease-out)]",
              open && "rotate-90"
            )}
          />
          {header}
        </button>
        {open && <div className={cn("space-y-3", contentClassName)}>{children}</div>}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-0.5 h-3.5 rounded-full bg-foreground/25 shrink-0" />
        {header}
      </div>
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </div>
  );
}
