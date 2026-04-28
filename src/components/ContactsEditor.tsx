import { useState } from "react";
import { Plus, Trash2, Check, Phone, Mail, UserRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, normalizePhone } from "@/lib/utils";
import { CONTACT_ROLES, roleLabel } from "@/lib/contactRoles";

export interface ContactRow {
  id?: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  role_label: string;
  notes: string;
}

interface ContactsEditorProps {
  initial: ContactRow[];
  onSave: (rows: ContactRow[]) => void;
}

const INLINE_CHROME =
  "w-full bg-transparent border-0 border-b border-dashed border-foreground/40 rounded-none " +
  "focus:outline-none focus:border-foreground/60 py-1 px-0 leading-[1.55] text-[13px] " +
  "text-foreground placeholder:text-muted-foreground/60 font-sans";

const ROLE_ORDER: Record<string, number> = {
  day_of_show: 0,
  promoter: 1,
  production: 2,
  hospitality: 3,
  custom: 4,
};

function roleSort(rows: ContactRow[]): ContactRow[] {
  return [...rows].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 5;
    const rb = ROLE_ORDER[b.role] ?? 5;
    return ra - rb;
  });
}

function emptyRow(role: string = "custom"): ContactRow {
  return { name: "", phone: "", email: "", role, role_label: "", notes: "" };
}

function rowIsBlank(r: ContactRow): boolean {
  return !r.name.trim() && !r.phone.trim() && !r.email.trim() && !r.notes.trim();
}

export default function ContactsEditor({ initial, onSave }: ContactsEditorProps) {
  const [rows, setRows] = useState<ContactRow[]>(() => initial);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<ContactRow | null>(null);

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setDraft({ ...rows[idx] });
  };

  const commitRow = () => {
    if (editingIdx === null || !draft) return;
    const cleaned: ContactRow = {
      ...draft,
      phone: draft.phone.trim() ? normalizePhone(draft.phone) : "",
      email: draft.email.trim(),
      name: draft.name.trim(),
      role_label: draft.role === "custom" ? draft.role_label.trim() : "",
    };
    const sorted = roleSort(rows.map((r, i) => (i === editingIdx ? cleaned : r)));
    setRows(sorted);
    setEditingIdx(null);
    setDraft(null);
    onSave(sorted.filter((r) => !rowIsBlank(r)));
  };

  const removeRow = (idx: number) => {
    const updated = rows.filter((_, i) => i !== idx);
    setRows(updated);
    if (editingIdx === idx) {
      setEditingIdx(null);
      setDraft(null);
    } else if (editingIdx !== null && editingIdx > idx) {
      setEditingIdx(editingIdx - 1);
    }
    onSave(updated.filter((r) => !rowIsBlank(r)));
  };

  const addRow = (role: string = "custom") => {
    const hasDos = rows.some((r) => r.role === "day_of_show");
    const startRole = role === "custom" && !hasDos ? "day_of_show" : role;
    const newRow = emptyRow(startRole);
    setRows((prev) => [...prev, newRow]);
    setEditingIdx(rows.length);
    setDraft(newRow);
  };

  if (rows.length === 0 && editingIdx === null) {
    return (
      <button
        type="button"
        onClick={() => addRow("day_of_show")}
        className="w-full rounded-[10px] border border-dashed border-border px-4 py-5 flex items-center gap-2.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="text-sm">Add a contact (DOS, promoter, production…)</span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) =>
        editingIdx === i && draft ? (
          // ── Edit row ──────────────────────────────────────────────────────
          <div key={i} className="rounded-md bg-muted/20 p-3 space-y-2.5">
            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <Select
                value={draft.role}
                onValueChange={(v) => setDraft((d) => (d ? { ...d, role: v } : null))}
              >
                <SelectTrigger className="h-8 text-xs uppercase tracking-wider w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key} className="text-xs uppercase tracking-wider">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Remove contact"
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

            {draft.role === "custom" && (
              <input
                type="text"
                value={draft.role_label}
                onChange={(e) => setDraft((d) => (d ? { ...d, role_label: e.target.value } : null))}
                placeholder="Role label (e.g. Runner, Box Office)"
                className={INLINE_CHROME}
              />
            )}
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : null))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitRow(); } }}
              placeholder="Name"
              autoFocus
              className={INLINE_CHROME}
            />
            <input
              type="tel"
              value={draft.phone}
              onChange={(e) => setDraft((d) => (d ? { ...d, phone: e.target.value } : null))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitRow(); } }}
              placeholder="Phone"
              inputMode="tel"
              className={cn(INLINE_CHROME, "font-mono")}
            />
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : null))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitRow(); } }}
              placeholder="Email"
              inputMode="email"
              className={cn(INLINE_CHROME, "font-mono")}
            />
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : null))}
              placeholder="Notes (optional)"
              rows={2}
              className={cn(INLINE_CHROME, "resize-y min-h-[2.25rem]")}
            />
          </div>
        ) : (
          // ── Read row ──────────────────────────────────────────────────────
          <button
            key={i}
            type="button"
            onClick={() => startEdit(i)}
            className="w-full text-left rounded-md px-3 py-2.5 hover:bg-muted/30 transition-colors space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {roleLabel(row)}
              </span>
              {rowIsBlank(row) && (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
              )}
            </div>
            {row.name && (
              <div className="flex items-center gap-2">
                <UserRound className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground">{row.name}</span>
              </div>
            )}
            {row.phone && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <a href={`tel:${row.phone}`} className="text-sm font-mono text-foreground hover:underline">
                  {row.phone}
                </a>
              </div>
            )}
            {row.email && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <a href={`mailto:${row.email}`} className="text-sm font-mono text-foreground hover:underline">
                  {row.email}
                </a>
              </div>
            )}
            {row.notes && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{row.notes}</div>
            )}
            {!row.name && !row.phone && !row.email && !row.notes && (
              <div className="text-sm text-muted-foreground/60 italic">Empty — click to edit</div>
            )}
          </button>
        )
      )}

      {/* Add contact */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => addRow()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/30"
        >
          <Plus className="h-3 w-3" />
          Add contact
        </button>
      </div>

    </div>
  );
}
