import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
          className="mb-3 w-full text-left group flex items-center gap-2"
        >
          <div className="w-0.5 h-3.5 rounded-full bg-foreground/25 shrink-0" />
          {header}
          <ChevronDown
            aria-hidden
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground/70",
              open && "rotate-180"
            )}
          />
        </button>
        <div
          className={cn(
            "grid [transition:grid-template-rows_220ms_var(--ease-out),opacity_180ms_var(--ease-out)]",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className={cn("space-y-3", contentClassName)}>{children}</div>
          </div>
        </div>
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
