import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { normalizeTime } from "@/lib/timeFormat";

function parseTime(raw: string): { hour: string; minute: string; ampm: "AM" | "PM" } | null {
  if (!raw || raw === "TBD") return null;
  const s = raw.trim();

  const withAmPm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (withAmPm) {
    return {
      hour: String(parseInt(withAmPm[1], 10)),
      minute: withAmPm[2],
      ampm: withAmPm[3].toUpperCase() as "AM" | "PM",
    };
  }

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

interface TimeInputProps {
  value: string; // "H:MM AM/PM", "TBD", or ""
  onChange: (value: string) => void;
  autoFocus?: boolean;
  hideTbd?: boolean;
  /**
   * `compact` swaps the 28px serif display for body-sized mono. Use when the
   * surrounding context reads as body text (e.g. a quiet inline-edit row)
   * rather than a hero/editor stage like ScheduleEditor's commit row.
   */
  compact?: boolean;
}

export default function TimeInput({ value, onChange, autoFocus, hideTbd, compact }: TimeInputProps) {
  const isTbd = value === "TBD";
  const parsed = parseTime(value);

  // Display the time portion only ("8:25") — AM/PM lives in the rail
  const [raw, setRaw] = useState(parsed ? `${parsed.hour}:${parsed.minute.padStart(2, "0")}` : "");
  const [ampm, setAmpm] = useState<"AM" | "PM">(parsed?.ampm ?? "AM");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [autoFocus]);

  // Sync if parent value changes externally (AI parse, reset, etc.)
  useEffect(() => {
    if (value === "TBD") return;
    const p = parseTime(value);
    if (p) {
      setRaw(`${p.hour}:${p.minute.padStart(2, "0")}`);
      setAmpm(p.ampm);
    } else if (!value) {
      setRaw("");
    }
  }, [value]);

  const normalize = (text: string, rail: "AM" | "PM") => {
    const trimmed = text.trim();
    // Clearing the field has to propagate — without onChange("") the parent
    // never learns the value was wiped, so a save would re-send the previous
    // value and the field would never actually clear.
    if (!trimmed) {
      onChange("");
      return;
    }
    // If user typed an explicit meridiem ("8p", "9am", "8:30 PM"), trust it
    // Otherwise, append the rail selection so "8:30" + PM rail → "8:30 PM"
    const hasExplicitMeridiem = /[ap]/i.test(trimmed);
    const toParse = hasExplicitMeridiem ? trimmed : `${trimmed} ${rail}`;
    const normalized = normalizeTime(toParse);
    if (!normalized) {
      setRaw("");
      onChange("");
      return;
    }
    // Update display to canonical H:MM form and sync rail
    const p = parseTime(normalized);
    if (p) {
      setRaw(`${p.hour}:${p.minute.padStart(2, "0")}`);
      setAmpm(p.ampm);
    }
    onChange(normalized);
  };

  const handleBlur = () => normalize(raw, ampm);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  const handleAmpmClick = (a: "AM" | "PM") => {
    setAmpm(a);
    // Re-emit immediately if there's already a valid time in the field
    normalize(raw, a);
  };

  const inputClass = compact
    ? "bg-transparent border-0 border-b border-dashed border-foreground/30 " +
      "focus:border-foreground/60 focus:outline-none rounded-none py-1 px-0 " +
      "font-mono text-sm font-medium text-foreground " +
      "placeholder:text-muted-foreground/40"
    : "bg-transparent border-0 border-b border-dashed border-foreground/30 " +
      "focus:border-foreground/60 focus:outline-none rounded-none p-0 " +
      "font-display text-[28px] leading-none tracking-tight text-foreground " +
      "placeholder:text-muted-foreground/40";

  return (
    <div className="inline-flex items-center gap-3 flex-wrap">
      {!isTbd && (
        <div className="inline-flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            inputMode="text"
            size={5}
            placeholder="–:––"
            aria-label="Time"
            className={inputClass}
          />

          <div className="inline-flex flex-col justify-center gap-0.5">
            {(["AM", "PM"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => handleAmpmClick(a)}
                aria-pressed={ampm === a}
                className={cn(
                  "text-[11px] font-mono font-semibold uppercase tracking-[0.14em]",
                  "py-1 pl-1.5 pr-1 border-l-2 text-left transition-colors select-none min-w-[32px]",
                  ampm === a
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
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
            "text-[11px] font-mono font-medium uppercase tracking-[0.1em] px-2 py-1 rounded-md border transition-colors",
            isTbd
              ? "bg-muted text-foreground border-input"
              : "text-muted-foreground/70 border-transparent hover:border-input hover:text-foreground"
          )}
        >
          TBD
        </button>
      )}
    </div>
  );
}
