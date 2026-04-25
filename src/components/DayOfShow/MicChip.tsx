import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface MicChipProps {
  label?: string;
  onClick: () => void;
  className?: string;
}

/**
 * Glowing entry chip for Day of Show Mode. Pulses continuously when mounted —
 * the parent decides whether to render it (visibility rule:
 * `isShowDay && !is_settled`).
 */
export default function MicChip({ label = "Day of Show", onClick, className }: MicChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Enter ${label}`}
      className={cn(
        "mic-chip-pulse inline-flex items-center gap-2 h-9 pr-3 pl-1.5",
        "rounded-full border text-[12.5px] font-medium tracking-[0.01em]",
        "[transition:transform_160ms_var(--ease-out),background-color_160ms_var(--ease-out)]",
        "active:scale-[0.97]",
        className,
      )}
      style={{
        background: "hsl(var(--badge-new) / 0.15)",
        borderColor: "hsl(var(--badge-new) / 0.4)",
        color: "var(--pastel-blue-fg)",
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: 22,
          height: 22,
          background: "hsl(var(--badge-new))",
          color: "#fff",
        }}
      >
        <Mic className="h-3 w-3" strokeWidth={2.4} />
      </span>
      <span>{label}</span>
    </button>
  );
}
