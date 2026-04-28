import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
}

export default function FieldGroup({
  title,
  children,
  className,
  contentClassName,
  collapsible,
  defaultOpen = true,
  headerRight,
}: FieldGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  const titleEl = (
    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground">
      {title}
    </span>
  );

  if (collapsible) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full text-left group flex items-center gap-2 pb-1.5 mb-2.5 border-b border-foreground/80"
        >
          {titleEl}
          {headerRight && (
            <span
              className="ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {headerRight}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground [transition:transform_200ms_var(--ease-out),color_150ms_var(--ease-out)] group-hover:text-foreground/70",
              headerRight ? "ml-2" : "ml-auto",
              open && "rotate-180",
            )}
          />
        </button>
        <div
          className={cn(
            "grid",
            // Asymmetric timing: expand is deliberate (220ms — user wants
            // to see content reveal), collapse is responsive (160ms — user
            // has decided to hide it).
            open
              ? "grid-rows-[1fr] opacity-100 [transition:grid-template-rows_220ms_var(--ease-out),opacity_180ms_var(--ease-out)]"
              : "grid-rows-[0fr] opacity-0 [transition:grid-template-rows_160ms_var(--ease-out),opacity_120ms_var(--ease-out)]",
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
      <div className="flex items-center gap-2 pb-1.5 mb-2.5 border-b border-foreground/80">
        {titleEl}
        {headerRight && <span className="ml-auto">{headerRight}</span>}
      </div>
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </div>
  );
}
