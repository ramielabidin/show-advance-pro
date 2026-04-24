import { useState, useEffect, useRef, useLayoutEffect, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface GuestEntry {
  name: string;
  plusOnes: number;
}

export function parseGuestList(raw: string | null | undefined): GuestEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const plusMatch = line.match(/\s*\+\s*(\d+)\s*$/);
        const plusOnes = plusMatch ? parseInt(plusMatch[1], 10) : 0;
        const name = plusMatch ? line.slice(0, plusMatch.index).trim() : line;
        return { name, plusOnes };
      });
  }
  return [];
}

export function serializeGuestList(entries: GuestEntry[]): string {
  return JSON.stringify(entries.filter((e) => e.name.trim()));
}

export function guestTotal(entries: GuestEntry[]): number {
  return entries.reduce((sum, e) => sum + 1 + e.plusOnes, 0);
}

export function parseComps(comps: string | null | undefined): number | null {
  if (!comps) return null;
  const n = parseInt(comps.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function GuestCount({ total, compsAllotment }: { total: number; compsAllotment?: string | null }) {
  const cap = parseComps(compsAllotment);

  let colorClass = "text-muted-foreground";
  if (cap !== null) {
    if (total >= cap) colorClass = "text-destructive";
    else if (total >= cap - 3) colorClass = "text-[var(--pastel-yellow-fg)]";
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", colorClass)}>
      <Users className="h-3 w-3" />
      <span>
        {total} guest{total !== 1 ? "s" : ""}
        {cap !== null ? ` / ${cap} spots` : ""}
      </span>
    </div>
  );
}

interface GuestListViewProps {
  value: string | null | undefined;
  capacity?: string | null;
  compsAllotment?: string | null;
  onEdit: () => void;
}

export function GuestListView({ value, compsAllotment, onEdit }: GuestListViewProps) {
  const entries = parseGuestList(value);
  if (entries.length === 0) return null;

  const total = guestTotal(entries);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <button
          onClick={onEdit}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Edit
        </button>
      </div>
      <div className="space-y-1">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-foreground">{entry.name}</span>
            {entry.plusOnes > 0 && (
              <span className="text-muted-foreground text-xs">+{entry.plusOnes}</span>
            )}
          </div>
        ))}
      </div>
      <div className="pt-1">
        <GuestCount total={total} compsAllotment={compsAllotment} />
      </div>
    </div>
  );
}

interface GuestListEditorProps {
  value: string | null | undefined;
  capacity?: string | null;
  compsAllotment?: string | null;
  onChange: (serialized: string) => void;
  isInline?: boolean;
}

export default function GuestListEditor({ value, compsAllotment, onChange }: GuestListEditorProps) {
  const [entries, setEntries] = useState<GuestEntry[]>(() => {
    const parsed = parseGuestList(value);
    return parsed.length > 0 ? parsed : [{ name: "", plusOnes: 0 }];
  });

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingFocusIdx = useRef<number | null>(null);

  useEffect(() => {
    onChange(serializeGuestList(entries));
  }, [entries]);

  useLayoutEffect(() => {
    if (pendingFocusIdx.current !== null) {
      const idx = pendingFocusIdx.current;
      pendingFocusIdx.current = null;
      inputRefs.current[idx]?.focus();
    }
  });

  const update = (idx: number, patch: Partial<GuestEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const appendBlankRow = () => {
    setEntries((prev) => {
      pendingFocusIdx.current = prev.length;
      return [...prev, { name: "", plusOnes: 0 }];
    });
  };

  const removeWithUndo = (idx: number) => {
    const entry = entries[idx];
    if (!entry) return;
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    toast("Guest removed", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          setEntries((prev) => {
            const next = [...prev];
            next.splice(Math.min(idx, next.length), 0, entry);
            return next;
          });
        },
      },
    });
  };

  const handleNameKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const current = entries[idx];
    if (!current?.name.trim()) return;
    appendBlankRow();
  };

  const handlePlusGuestsChange = (idx: number, raw: string) => {
    if (raw === "") {
      update(idx, { plusOnes: 0 });
      return;
    }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    update(idx, { plusOnes: Math.max(0, Math.min(9, parsed)) });
  };

  const total = guestTotal(entries.filter((e) => e.name.trim()));
  const cap = parseComps(compsAllotment);
  const atCapacity = cap !== null && total >= cap;
  const hasBlankRow = entries.length > 0 && !entries[entries.length - 1].name.trim();

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            value={entry.name}
            onChange={(e) => update(i, { name: e.target.value })}
            onKeyDown={(e) => handleNameKeyDown(i, e)}
            placeholder="Guest name"
            className="text-sm h-11 sm:h-9 flex-1"
          />
          <div className="flex items-center shrink-0">
            <span
              className={cn(
                "text-xs pr-0.5",
                entry.plusOnes > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              +
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={9}
              value={entry.plusOnes === 0 ? "" : String(entry.plusOnes)}
              onChange={(e) => handlePlusGuestsChange(i, e.target.value)}
              placeholder="0"
              aria-label="Additional guests"
              className="text-sm h-11 sm:h-9 w-11 px-1 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeWithUndo(i)}
            aria-label="Remove guest"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1 min-h-7">
        {!hasBlankRow ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={appendBlankRow}
            className="h-7 text-xs gap-1"
            disabled={atCapacity}
          >
            <Plus className="h-3 w-3" /> Add Guest
          </Button>
        ) : (
          <span />
        )}
        <GuestCount total={total} compsAllotment={compsAllotment} />
      </div>
    </div>
  );
}
