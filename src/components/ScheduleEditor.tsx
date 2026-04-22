import { useState } from "react";
import { Plus, Trash2, Mic, Check } from "lucide-react";
import TimeInput from "@/components/TimeInput";
import { cn } from "@/lib/utils";
import { to24Hour } from "@/lib/timeFormat";

export interface ScheduleRow {
  time: string;
  label: string;
  is_band: boolean;
}

interface ScheduleEditorProps {
  initial: ScheduleRow[];
  onSave: (rows: ScheduleRow[]) => void;
  saving?: boolean;
}

const INLINE_CHROME =
  "w-full bg-transparent border-0 border-b border-dashed border-foreground/40 rounded-none " +
  "focus:outline-none focus:border-foreground/60 py-1 px-0 leading-[1.55] text-[13px] " +
  "text-foreground placeholder:text-muted-foreground/60 font-sans";

function chronoSort(rows: ScheduleRow[]): ScheduleRow[] {
  return [...rows].sort((a, b) => {
    const ta = to24Hour(a.time) ?? "99:99";
    const tb = to24Hour(b.time) ?? "99:99";
    return ta.localeCompare(tb);
  });
}

export default function ScheduleEditor({ initial, onSave, saving }: ScheduleEditorProps) {
  const [rows, setRows] = useState<ScheduleRow[]>(() => (initial.length > 0 ? initial : []));
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<ScheduleRow | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setDraft({ ...rows[idx] });
  };

  const commitRow = () => {
    if (editingIdx === null || !draft) return;
    let updated = rows.map((r, i) => (i === editingIdx ? draft : r));
    // Enforce single is_band flag
    if (draft.is_band) {
      updated = updated.map((r, i) => (i === editingIdx ? r : { ...r, is_band: false }));
    }
    setRows(chronoSort(updated));
    setEditingIdx(null);
    setDraft(null);
    setIsDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) {
      setEditingIdx(null);
      setDraft(null);
    } else if (editingIdx !== null && editingIdx > idx) {
      setEditingIdx(editingIdx - 1);
    }
    setIsDirty(true);
  };

  const addRow = () => {
    const newRow: ScheduleRow = { time: "", label: "", is_band: false };
    setRows((prev) => [...prev, newRow]);
    setEditingIdx(rows.length);
    setDraft(newRow);
  };

  const reset = () => {
    setRows(initial.length > 0 ? initial : []);
    setEditingIdx(null);
    setDraft(null);
    setIsDirty(false);
  };

  if (rows.length === 0 && editingIdx === null) {
    return (
      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-[10px] border border-dashed border-border px-4 py-5 flex items-center gap-2.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="text-sm">Add schedule items (load-in, doors, set…)</span>
      </button>
    );
  }

  return (
    <div className="space-y-0.5">
      {rows.map((row, i) =>
        editingIdx === i && draft ? (
          // ── Edit row ──────────────────────────────────────────────────────
          <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center py-2 px-2 rounded-md bg-muted/20">
            <TimeInput
              value={draft.time}
              onChange={(val) => setDraft((d) => (d ? { ...d, time: val } : null))}
              hideTbd
            />
            <input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft((d) => (d ? { ...d, label: e.target.value } : null))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitRow(); } }}
              placeholder="Activity"
              autoFocus
              className={INLINE_CHROME}
            />
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setDraft((d) => (d ? { ...d, is_band: !d.is_band } : null))}
                aria-pressed={draft.is_band}
                title={draft.is_band ? "Unmark artist's set" : "Mark as artist's set"}
                className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                  draft.is_band
                    ? "text-[var(--pastel-green-fg)]"
                    : "text-muted-foreground/50 hover:text-foreground",
                )}
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove entry"
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={commitRow}
                aria-label="Done"
                className="h-8 w-8 rounded-md flex items-center justify-center bg-foreground text-background"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          // ── Read row ──────────────────────────────────────────────────────
          <button
            key={i}
            type="button"
            onClick={() => startEdit(i)}
            className="w-full grid grid-cols-[92px_1fr_auto] gap-3 items-center py-2.5 px-2 rounded-md hover:bg-muted/30 transition-colors text-left group"
          >
            <span
              className={cn(
                "font-mono text-sm font-medium shrink-0 whitespace-nowrap",
                row.is_band ? "text-[var(--pastel-green-fg)]" : "text-muted-foreground",
              )}
            >
              {row.time || "—"}
            </span>
            <span
              className={cn(
                "text-sm flex items-center gap-1.5",
                row.is_band ? "font-medium text-foreground" : "text-foreground",
              )}
            >
              {row.is_band && (
                <Mic className="h-3 w-3 text-[var(--pastel-green-fg)] shrink-0" />
              )}
              {row.label || <span className="text-muted-foreground/50 font-normal">Activity</span>}
            </span>
            {row.is_band ? (
              <span className="text-[10px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">
                SET
              </span>
            ) : (
              <span />
            )}
          </button>
        )
      )}

      {/* Add entry */}
      <div className="pt-1">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/30"
        >
          <Plus className="h-3 w-3" />
          Add entry
        </button>
      </div>

      {/* Save / Cancel — only visible when dirty */}
      {isDirty && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 mt-1">
          <button
            type="button"
            onClick={reset}
            className="h-7 px-2.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(rows.filter((r) => r.time.trim() || r.label.trim()))}
            disabled={saving}
            className="h-7 px-2.5 text-xs rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Save schedule
          </button>
        </div>
      )}
    </div>
  );
}
