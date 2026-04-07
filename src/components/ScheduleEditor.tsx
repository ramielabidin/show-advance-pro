import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save, X } from "lucide-react";

export interface ScheduleRow {
  time: string;
  label: string;
  is_band: boolean;
}

interface ScheduleEditorProps {
  initial: ScheduleRow[];
  onSave: (rows: ScheduleRow[]) => void;
  onCancel: () => void;
  saving?: boolean;
}

/** Normalize free-text time to "H:MM AM/PM" format. Returns original if unparseable. */
function normalizeTime(raw: string): string {
  const s = raw.trim();
  if (!s) return s;

  let ampm: "AM" | "PM" | null = null;
  let cleaned = s;

  // Extract AM/PM suffix
  const ampmMatch = cleaned.match(/\s*(a|am|p|pm)\s*$/i);
  if (ampmMatch) {
    ampm = ampmMatch[1].toLowerCase().startsWith("a") ? "AM" : "PM";
    cleaned = cleaned.slice(0, ampmMatch.index).trim();
  }

  let hours: number | null = null;
  let minutes = 0;

  // "3:30" or "15:30"
  const colonMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    hours = parseInt(colonMatch[1], 10);
    minutes = parseInt(colonMatch[2], 10);
  }
  // "1530" (4 digits, no colon)
  else if (/^\d{3,4}$/.test(cleaned)) {
    const n = parseInt(cleaned, 10);
    if (cleaned.length === 4) {
      hours = Math.floor(n / 100);
      minutes = n % 100;
    } else {
      // 3 digits like "930" → 9:30
      hours = Math.floor(n / 100);
      minutes = n % 100;
    }
  }
  // Single or double digit like "3" or "12"
  else if (/^\d{1,2}$/.test(cleaned)) {
    hours = parseInt(cleaned, 10);
    minutes = 0;
  }

  if (hours === null || minutes < 0 || minutes > 59) return raw;
  if (hours < 0 || hours > 23) return raw;

  // Convert 24h to 12h if needed
  if (hours >= 13 && !ampm) {
    ampm = "PM";
    hours -= 12;
  } else if (hours === 0 && !ampm) {
    ampm = "AM";
    hours = 12;
  } else if (hours === 12 && !ampm) {
    ampm = "PM";
  }

  // Default to PM for ambiguous times
  if (!ampm) ampm = "PM";

  // If hours > 12 after extraction (shouldn't happen but safety)
  if (hours > 12) return raw;

  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

export default function ScheduleEditor({ initial, onSave, onCancel, saving }: ScheduleEditorProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(() =>
    initial.length > 0 ? initial : [{ time: "", label: "", is_band: false }]
  );

  const update = (idx: number, patch: Partial<ScheduleRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const remove = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { time: "", label: "", is_band: false }]);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={row.time}
            onChange={(e) => update(i, { time: e.target.value })}
            onBlur={() => {
              const normalized = normalizeTime(row.time);
              if (normalized !== row.time) update(i, { time: normalized });
            }}
            placeholder="5:30 PM"
            className="text-sm h-9 w-24 font-mono shrink-0"
            autoFocus={i === 0 && rows.length === 1 && !row.time}
          />
          <Input
            value={row.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Activity"
            className="text-sm h-9 flex-1"
          />
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
      <Button variant="ghost" size="sm" onClick={addRow} className="h-7 text-xs gap-1">
        <Plus className="h-3 w-3" /> Add Entry
      </Button>
      <div className="flex items-center gap-1.5 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(rows.filter((r) => r.time.trim() || r.label.trim()))}
          disabled={saving}
          className="h-7 text-xs"
        >
          <Save className="h-3 w-3 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}
