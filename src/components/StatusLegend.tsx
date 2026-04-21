import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_COLOR, STATUS_LABEL } from "@/components/StatusDot";

const ENTRIES = [
  { key: "advanced", color: STATUS_COLOR.advanced, label: STATUS_LABEL.advanced },
  { key: "pending", color: STATUS_COLOR.pending, label: STATUS_LABEL.pending },
  { key: "urgent", color: STATUS_COLOR.urgent, label: STATUS_LABEL.urgent },
] as const;

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
        <ul className="space-y-1.5">
          {ENTRIES.map((entry) => (
            <li key={entry.key} className="flex items-center gap-2 text-sm text-foreground">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              {entry.label}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
