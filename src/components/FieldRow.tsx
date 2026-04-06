import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface FieldRowProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

/** Detect patterns like "1. foo 2. bar" or "1) foo 2) bar" and split into list items */
function parseNumberedList(text: string): string[] | null {
  // Match "1. " or "1) " patterns with at least 2 items
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

export default function FieldRow({ label, value, mono }: FieldRowProps) {
  if (!value) return null;

  const listItems = useMemo(() => parseNumberedList(value), [value]);

  return (
    <div className="flex items-start gap-4">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      {listItems ? (
        <ol className="text-sm text-foreground list-decimal list-outside pl-4 space-y-1">
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      ) : (
        <span className={cn("text-sm text-foreground whitespace-pre-line", mono && "font-mono text-[13px]")}>
          {value}
        </span>
      )}
    </div>
  );
}
