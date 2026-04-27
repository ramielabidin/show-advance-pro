import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface FieldRowProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  compact?: boolean;
  noLabel?: boolean;
}

/** Detect patterns like "1. foo 2. bar" or "1) foo 2) bar" and split into list items */
function parseNumberedList(text: string): string[] | null {
  const pattern = /(?:^|\s)(\d+)[.)]\s/g;
  const matches = [...text.matchAll(pattern)];
  if (matches.length < 2) return null;

  const items: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + (matches[i][0].startsWith(" ") ? 1 : 0);
    const end = i + 1 < matches.length
      ? matches[i + 1].index! + (matches[i + 1][0].startsWith(" ") ? 1 : 0)
      : text.length;
    const item = text.slice(start, end).replace(/^\d+[.)]\s*/, "").trim();
    if (item) items.push(item);
  }
  return items.length >= 2 ? items : null;
}

export default function FieldRow({ label, value, mono, compact, noLabel }: FieldRowProps) {
  const listItems = useMemo(() => value ? parseNumberedList(value) : null, [value]);

  if (!value) return null;

  // group-hover styles only activate when an ancestor has the `group` class —
  // that's how editField wraps its rows, so the affordance shows up only when
  // the row is interactive. Inert consumers (guest view) are unaffected.
  const valueClass = cn(
    "text-sm text-foreground whitespace-pre-line underline decoration-dashed decoration-transparent underline-offset-[3px] [transition:text-decoration-color_150ms_var(--ease-out)] group-hover:decoration-foreground/30",
    mono && "font-mono text-[13px]",
  );

  if (noLabel) {
    return listItems ? (
      <ol className="text-sm text-foreground list-decimal list-outside pl-4 space-y-1">
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    ) : (
      <span className={valueClass}>
        {value}
      </span>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <span
        className={cn(
          "text-sm text-muted-foreground sm:shrink-0 [transition:color_150ms_var(--ease-out)] group-hover:text-foreground/85",
          compact ? "sm:w-16" : "sm:w-32",
        )}
      >
        {label}
      </span>
      {listItems ? (
        <ol className="text-sm text-foreground list-decimal list-outside pl-4 space-y-1">
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      ) : (
        <span className={valueClass}>
          {value}
        </span>
      )}
    </div>
  );
}
