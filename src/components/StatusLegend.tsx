import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NEEDS_ATTENTION_COLOR, NEEDS_ATTENTION_LABEL } from "@/components/StatusDot";

export default function StatusLegend() {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Show status key"
      >
        <Info className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-auto p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-2">
          Show status
        </p>
        <ul className="space-y-1.5 text-sm text-foreground">
          <li className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full shrink-0 border border-muted-foreground/40" aria-hidden />
            Advanced
            <span className="text-muted-foreground text-xs">(no mark)</span>
          </li>
          <li className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: NEEDS_ATTENTION_COLOR }}
              aria-hidden
            />
            {NEEDS_ATTENTION_LABEL}
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
