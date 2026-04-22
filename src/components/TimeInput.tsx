import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

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
}

/**
 * Editorial time picker. Two free-type HH / MM inputs in the display
 * typeface, with a vertical AM/PM rail. Typing a 2-digit hour (or a
 * first digit that can't lead a valid 1–12 hour) auto-advances focus
 * to minutes; blurring minutes zero-pads single digits.
 */
export default function TimeInput({ value, onChange, autoFocus, hideTbd }: TimeInputProps) {
  const isTbd = value === "TBD";
  const parsed = parseTime(value);

  const [hour, setHour] = useState(parsed?.hour ?? "");
  const [minute, setMinute] = useState(parsed?.minute ?? "");
  const [ampm, setAmpm] = useState<"AM" | "PM">(parsed?.ampm ?? "AM");

  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    hourRef.current?.focus();
    hourRef.current?.select();
  }, [autoFocus]);

  // Sync if parent value changes externally (AI parse, reset, etc.)
  useEffect(() => {
    if (value === "TBD") return;
    const p = parseTime(value);
    if (p) {
      setHour(p.hour);
      setMinute(p.minute);
      setAmpm(p.ampm);
    } else if (!value) {
      setHour("");
      setMinute("");
    }
  }, [value]);

  const emit = (h: string, m: string, a: "AM" | "PM") => {
    if (!h) return;
    const paddedM = (m || "0").padStart(2, "0");
    onChange(`${h}:${paddedM} ${a}`);
  };

  const handleHourChange = (e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, "").slice(-2);
    setHour(d);
    emit(d, minute, ampm);
    // Auto-advance when we hit 2 digits or a first digit that can't lead a valid 1–12 hour
    if (d.length === 2 || (d.length === 1 && parseInt(d, 10) >= 2)) {
      minuteRef.current?.focus();
      minuteRef.current?.select();
    }
  };

  const handleMinuteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, "").slice(-2);
    setMinute(d);
    emit(hour, d, ampm);
  };

  const handleMinuteBlur = () => {
    if (minute && minute.length < 2) {
      const padded = minute.padStart(2, "0");
      setMinute(padded);
      emit(hour, padded, ampm);
    }
  };

  const numberInputClass =
    "w-[1.35em] bg-transparent border-0 border-b border-dashed border-foreground/30 " +
    "focus:border-foreground/60 focus:outline-none rounded-none p-0 " +
    "font-display text-[28px] leading-none tracking-tight text-foreground " +
    "placeholder:text-muted-foreground/40 appearance-none [-moz-appearance:textfield] " +
    "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div className="inline-flex items-center gap-3 flex-wrap">
      {!isTbd && (
        <div className="inline-flex items-center gap-3">
          <div className="inline-flex items-baseline gap-0.5">
            <input
              ref={hourRef}
              value={hour}
              onChange={handleHourChange}
              inputMode="numeric"
              maxLength={2}
              placeholder="--"
              aria-label="Hour"
              className={cn(numberInputClass, "text-right")}
            />
            <span className="font-display text-[28px] leading-none text-muted-foreground/60 px-0.5">:</span>
            <input
              ref={minuteRef}
              value={minute}
              onChange={handleMinuteChange}
              onBlur={handleMinuteBlur}
              inputMode="numeric"
              maxLength={2}
              placeholder="--"
              aria-label="Minute"
              className={cn(numberInputClass, "text-left")}
            />
          </div>

          <div className="inline-flex flex-col justify-center gap-0.5">
            {(["AM", "PM"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => { setAmpm(a); emit(hour, minute, a); }}
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
