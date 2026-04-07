import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Users } from "lucide-react";

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
    // Legacy free-text: convert lines to entries
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

interface GuestListViewProps {
  value: string | null | undefined;
  capacity?: string | null;
  onEdit: () => void;
}

export function GuestListView({ value, capacity, onEdit }: GuestListViewProps) {
  const entries = parseGuestList(value);
  if (entries.length === 0) return null;

  const total = guestTotal(entries);
  const cap = capacity ? parseInt(capacity.replace(/[^0-9]/g, ""), 10) : null;
  const validCap = cap && !isNaN(cap) ? cap : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Guest List</span>
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
        <Users className="h-3 w-3" />
        <span>
          {total} guest{total !== 1 ? "s" : ""}
          {validCap ? ` / ${validCap} capacity` : ""}
        </span>
      </div>
    </div>
  );
}

interface GuestListEditorProps {
  value: string | null | undefined;
  capacity?: string | null;
  onChange: (serialized: string) => void;
}

export default function GuestListEditor({ value, capacity, onChange }: GuestListEditorProps) {
  const [entries, setEntries] = useState<GuestEntry[]>(() => {
    const parsed = parseGuestList(value);
    return parsed.length > 0 ? parsed : [{ name: "", plusOnes: 0 }];
  });

  useEffect(() => {
    onChange(serializeGuestList(entries));
  }, [entries]);

  const update = (idx: number, patch: Partial<GuestEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const remove = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    setEntries((prev) => [...prev, { name: "", plusOnes: 0 }]);
  };

  const total = guestTotal(entries.filter((e) => e.name.trim()));
  const cap = capacity ? parseInt(capacity.replace(/[^0-9]/g, ""), 10) : null;
  const validCap = cap && !isNaN(cap) ? cap : null;

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={entry.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Guest name"
            className="text-sm h-9 flex-1"
            autoFocus={i === entries.length - 1}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground">+1</span>
            <Switch
              checked={entry.plusOnes > 0}
              onCheckedChange={(checked) => update(i, { plusOnes: checked ? 1 : 0 })}
              className="scale-75"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={addRow} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" /> Add Guest
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>
            {total} guest{total !== 1 ? "s" : ""}
            {validCap ? ` / ${validCap} capacity` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
