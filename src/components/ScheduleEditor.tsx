import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, X, Mic } from "lucide-react";
import TimeInput from "@/components/TimeInput";
import { cn } from "@/lib/utils";

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

export default function ScheduleEditor({ initial, onSave, onCancel, saving }: ScheduleEditorProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(() =>
    initial.length > 0 ? initial : [{ time: "", label: "", is_band: false }]
  );

  const update = (idx: number, patch: Partial<ScheduleRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  // Only one row can be the artist's set — toggling one on clears the rest.
  const toggleBand = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => ({ ...r, is_band: i === idx ? !r.is_band : false }))
    );
  };

  const remove = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { time: "", label: "", is_band: false }]);
  };

  return (
    <div className="space-y-3 sm:space-y-2">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2"
        >
          <div className="shrink-0">
            <TimeInput
              value={row.time}
              onChange={(val) => update(i, { time: val })}
              autoFocus={i === 0 && rows.length === 1 && !row.time}
              hideTbd
            />
          </div>
          <div className="flex items-center gap-2 sm:flex-1">
            <Input
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Activity"
              className="text-sm h-11 sm:h-9 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0",
                row.is_band
                  ? "text-[var(--pastel-green-fg)] hover:text-[var(--pastel-green-fg)]"
                  : "text-muted-foreground/50 hover:text-foreground"
              )}
              onClick={() => toggleBand(i)}
              aria-label={row.is_band ? "Unmark artist's set" : "Mark as artist's set"}
              title={row.is_band ? "Artist's set" : "Mark as artist's set"}
            >
              <Mic className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
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
