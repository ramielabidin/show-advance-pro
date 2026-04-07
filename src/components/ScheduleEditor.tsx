import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, X } from "lucide-react";
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
            placeholder="5:30 PM"
            className="text-sm h-9 w-20 font-mono shrink-0"
            autoFocus={i === 0 && rows.length === 1 && !row.time}
          />
          <Input
            value={row.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Activity"
            className="text-sm h-9 flex-1"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "text-[10px] font-bold tracking-wide",
                row.is_band ? "text-primary" : "text-muted-foreground/50"
              )}
            >
              JUICE
            </span>
            <Switch
              checked={row.is_band}
              onCheckedChange={(checked) => update(i, { is_band: checked })}
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
