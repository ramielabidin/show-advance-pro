import { useEffect, useRef, type RefObject, type KeyboardEvent, type MouseEvent } from "react";
import { Check, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const IS_MAC = typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

interface InlineEditableProps {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  multiline?: boolean;
  mono?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "decimal" | "email" | "url";
  saving?: boolean;
  className?: string;
}

/**
 * Chromeless inline edit primitive. Renders a dashed-underline input or
 * textarea with no border/ring and a keyboard-hint cluster on the right.
 * Parent owns draft state via `value` + `onChange`; `onSave` and `onCancel`
 * fire on Enter (⌘/Ctrl+Enter for multiline) / blur / Escape respectively.
 *
 * Mobile handling: kbd hints hide below md, and multiline gets tappable
 * ✓ / ✕ icon buttons since there's no Cmd+Enter or Escape on a touch keyboard.
 */
export default function InlineEditable({
  value,
  onChange,
  onSave,
  onCancel,
  multiline = false,
  mono = false,
  placeholder,
  autoFocus = true,
  inputMode,
  saving,
  className,
}: InlineEditableProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const didSettle = useRef(false);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    if ("select" in el && typeof el.select === "function") el.select();
  }, [autoFocus]);

  const commit = () => {
    if (didSettle.current) return;
    didSettle.current = true;
    onSave();
  };

  const cancel = () => {
    if (didSettle.current) return;
    didSettle.current = true;
    onCancel();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  // Prevent the input from blurring before the click fires — without this,
  // tapping the save/cancel button on mobile loses focus first and the blur
  // handler runs before the click handler, producing the wrong outcome.
  const preventBlur = (e: MouseEvent) => {
    e.preventDefault();
  };

  const inputClassName = cn(
    "w-full bg-transparent border-0 border-b border-dashed border-foreground/40 rounded-none",
    "focus:outline-none focus:border-foreground/60",
    "py-1 px-0 leading-[1.55] text-[13px] text-foreground placeholder:text-muted-foreground/60",
    mono ? "font-mono" : "font-sans",
    multiline && "min-h-[72px] resize-y",
    className,
  );

  const kbdChar = multiline ? (IS_MAC ? "⌘⏎" : "Ctrl+⏎") : "⏎";

  return (
    <div className={cn("w-full", multiline ? "space-y-2" : "flex flex-wrap items-center gap-3")}>
      {multiline ? (
        <textarea
          ref={ref as RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          enterKeyHint="done"
          inputMode={inputMode}
          className={inputClassName}
        />
      ) : (
        <input
          ref={ref as RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          enterKeyHint="done"
          inputMode={inputMode}
          className={inputClassName}
        />
      )}

      {/* Desktop keyboard hints */}
      <div
        className={cn(
          "hidden md:flex items-center gap-2 text-[10px] font-mono text-muted-foreground/70 shrink-0 select-none",
          multiline && "self-start",
        )}
      >
        <span className="inline-flex items-center gap-1">
          <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-border bg-muted/40 font-mono text-[10px] leading-none">
            {kbdChar}
          </kbd>
          save
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-border bg-muted/40 font-mono text-[10px] leading-none">
            esc
          </kbd>
        </span>
      </div>

      {/* Mobile save/cancel for multiline (Cmd+Enter and Esc aren't reachable on touch) */}
      {multiline && (
        <div className="flex md:hidden items-center gap-1 self-end">
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={cancel}
            aria-label="Cancel"
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onMouseDown={preventBlur}
            onClick={commit}
            disabled={saving}
            aria-label="Save"
            className="h-8 w-8 rounded-md flex items-center justify-center bg-foreground text-background disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
