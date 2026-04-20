import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function parseTime(raw: string): { hour: string; minute: string; ampm: "AM" | "PM" } | null {
  if (!raw || raw === "TBD") return null;
  const s = raw.trim();

  // "H:MM AM/PM" or "HH:MM AM/PM"
  const withAmPm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (withAmPm) {
    return {
      hour: String(parseInt(withAmPm[1], 10)),
      minute: withAmPm[2],
      ampm: withAmPm[3].toUpperCase() as "AM" | "PM",
    };
  }

  // "H:MM" or "HH:MM" (24h or ambiguous) — treat >=12 as PM
  const noAmPm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (noAmPm) {
    const h = parseInt(noAmPm[1], 10);
    return {
      hour: h > 12 ? String(h - 12) : h === 0 ? "12" : String(h),
      minute: noAmPm[2],
      ampm: h >= 12 ? "PM" : "AM",
    };
  }

  return null;
}

/** Snap minute string to nearest 5-min increment for the select */
function snapMinute(min: string): string {
  const n = parseInt(min, 10);
  if (isNaN(n)) return "00";
  const snapped = Math.round(n / 5) * 5;
  return String(Math.min(55, Math.max(0, snapped))).padStart(2, "0");
}

interface TimeInputProps {
  value: string; // "H:MM AM/PM", "TBD", or ""
  onChange: (value: string) => void;
  autoFocus?: boolean;
  hideTbd?: boolean;
}

export default function TimeInput({ value, onChange, autoFocus, hideTbd }: TimeInputProps) {
  const isTbd = value === "TBD";
  const parsed = parseTime(value);

  const [hour, setHour] = useState(parsed?.hour ?? "");
  const [minute, setMinute] = useState(parsed?.minute ? snapMinute(parsed.minute) : "00");
  const [ampm, setAmpm] = useState<"AM" | "PM">(parsed?.ampm ?? "AM");

  // Sync state if parent value changes (e.g. after AI parse)
  useEffect(() => {
    if (value === "TBD") return;
    const p = parseTime(value);
    if (p) {
      setHour(p.hour);
      setMinute(snapMinute(p.minute));
      setAmpm(p.ampm);
    }
  }, [value]);

  const emit = (h: string, m: string, a: "AM" | "PM") => {
    if (h) onChange(`${h}:${m} ${a}`);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!isTbd && (
        <div className="flex items-center gap-1">
          <Select
            value={hour}
            onValueChange={(h) => { setHour(h); emit(h, minute, ampm); }}
          >
            <SelectTrigger className="w-16 h-11 sm:h-9 text-sm font-mono" autoFocus={autoFocus}>
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={h} className="font-mono">{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-muted-foreground font-mono text-sm select-none">:</span>

          <Select
            value={minute}
            onValueChange={(m) => { setMinute(m); emit(hour, m, ampm); }}
          >
            <SelectTrigger className="w-16 h-11 sm:h-9 text-sm font-mono">
              <SelectValue placeholder="00" />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((m) => (
                <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-md border border-input overflow-hidden text-xs shrink-0">
            {(["AM", "PM"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => { setAmpm(a); emit(hour, minute, a); }}
                className={cn(
                  "px-2.5 py-1.5 font-medium transition-colors",
                  ampm === a
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hideTbd && (
        <button
          type="button"
          onClick={() => onChange(isTbd ? "" : "TBD")}
          className={cn(
            "text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors",
            isTbd
              ? "bg-muted text-foreground border-input"
              : "text-muted-foreground border-transparent hover:border-input hover:text-foreground"
          )}
        >
          TBD
        </button>
      )}
    </div>
  );
}
