import {
  KeyboardEvent,
  FocusEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Plus, Trash2, UsersRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface GuestEntry {
  name: string;
  plusOnes: number;
}

interface GuestRow extends GuestEntry {
  id: string;
}

let idCounter = 0;
const newId = () => `g${Date.now()}-${++idCounter}`;

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
  return JSON.stringify(
    entries
      .filter((e) => e.name.trim())
      .map((e) => ({ name: e.name.trim(), plusOnes: e.plusOnes })),
  );
}

export function guestTotal(entries: GuestEntry[]): number {
  return entries.reduce((sum, e) => sum + 1 + e.plusOnes, 0);
}

export function parseComps(comps: string | null | undefined): number | null {
  if (!comps) return null;
  const n = parseInt(comps.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

interface GuestCountProps {
  total: number;
  compsAllotment?: string | null;
  className?: string;
}

export function GuestCount({ total, compsAllotment, className }: GuestCountProps) {
  const cap = parseComps(compsAllotment);

  let colorClass = "text-muted-foreground";
  if (cap !== null) {
    if (total >= cap) colorClass = "text-destructive";
    else if (total >= cap - 3) colorClass = "text-[var(--pastel-yellow-fg)]";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs",
        colorClass,
        className,
      )}
    >
      <UsersRound className="h-3 w-3" />
      <span>
        {total}
        {cap !== null ? `/${cap}` : ""}
      </span>
    </span>
  );
}

interface GuestListEditorProps {
  value: string | null | undefined;
  capacity?: string | null;
  compsAllotment?: string | null;
  onChange: (serialized: string) => void;
}

export default function GuestListEditor({ value, compsAllotment, onChange }: GuestListEditorProps) {
  const [rows, setRows] = useState<GuestRow[]>(() =>
    parseGuestList(value).map((e) => ({ ...e, id: newId() })),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; plus: string }>({ name: "", plus: "" });
  const editStartName = useRef<string>("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFocusId = useRef<string | null>(null);

  // Track the serialized form last reflected in `rows` so external `value`
  // updates (undo, navigation, real-time refresh) re-sync without overwriting
  // the user's in-flight edit on every parent re-render.
  const lastSerializedRef = useRef<string>(serializeGuestList(parseGuestList(value)));

  useEffect(() => {
    const incoming = serializeGuestList(parseGuestList(value));
    if (incoming === lastSerializedRef.current) return;
    lastSerializedRef.current = incoming;
    setRows(parseGuestList(value).map((e) => ({ ...e, id: newId() })));
    setEditingId(null);
  }, [value]);

  useLayoutEffect(() => {
    if (pendingFocusId.current && pendingFocusId.current === editingId) {
      pendingFocusId.current = null;
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingId]);

  const total = guestTotal(rows);
  const cap = parseComps(compsAllotment);
  const atCapacity = cap !== null && total >= cap;

  const emit = (next: GuestRow[]) => {
    setRows(next);
    const serialized = serializeGuestList(next);
    lastSerializedRef.current = serialized;
    onChange(serialized);
  };

  const startEdit = (row: GuestRow) => {
    editStartName.current = row.name;
    setDraft({ name: row.name, plus: row.plusOnes ? String(row.plusOnes) : "" });
    pendingFocusId.current = row.id;
    setEditingId(row.id);
  };

  const cancel = () => setEditingId(null);

  const buildCommitted = (): GuestRow[] => {
    if (editingId == null) return rows;
    const trimmed = draft.name.trim();
    const plus = Math.max(0, Math.min(9, parseInt(draft.plus, 10) || 0));
    return trimmed
      ? rows.map((r) => (r.id === editingId ? { ...r, name: trimmed, plusOnes: plus } : r))
      : rows.filter((r) => r.id !== editingId);
  };

  // Blur should never silently delete a previously-named row when the user
  // accidentally clears the input. Trash + Enter-on-empty are the explicit
  // delete affordances.
  const safeBlurCommit = () => {
    if (editingId == null) return;
    const trimmed = draft.name.trim();
    if (!trimmed) {
      if (editStartName.current) {
        setEditingId(null);
        return;
      }
      const next = rows.filter((r) => r.id !== editingId);
      emit(next);
      setEditingId(null);
      return;
    }
    emit(buildCommitted());
    setEditingId(null);
  };

  const commitAndNext = () => {
    const after = buildCommitted();
    emit(after);
    if (cap !== null && guestTotal(after) >= cap) {
      setEditingId(null);
      return;
    }
    const id = newId();
    const next = [...after, { id, name: "", plusOnes: 0 }];
    setRows(next);
    editStartName.current = "";
    setDraft({ name: "", plus: "" });
    pendingFocusId.current = id;
    setEditingId(id);
  };

  const addBlankRow = () => {
    if (atCapacity) return;
    const id = newId();
    setRows((curr) => [...curr, { id, name: "", plusOnes: 0 }]);
    editStartName.current = "";
    setDraft({ name: "", plus: "" });
    pendingFocusId.current = id;
    setEditingId(id);
  };

  const removeWithUndo = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const removed = rows[idx];
    const next = rows.filter((r) => r.id !== id);
    emit(next);
    if (editingId === id) setEditingId(null);
    if (!removed.name.trim()) return;
    toast("Guest removed", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          setRows((curr) => {
            const restored = [...curr];
            restored.splice(Math.min(idx, restored.length), 0, removed);
            const serialized = serializeGuestList(restored);
            lastSerializedRef.current = serialized;
            onChange(serialized);
            return restored;
          });
        },
      },
    });
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAndNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const handlePlusKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAndNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const handleNameBlur = (rowId: string, e: FocusEvent<HTMLInputElement>) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next?.dataset?.rowSibling === rowId) return;
    safeBlurCommit();
  };

  const handlePlusBlur = (e: FocusEvent<HTMLInputElement>) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next?.tagName === "INPUT" && next.getAttribute("placeholder") === "Guest name") return;
    safeBlurCommit();
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {rows.length === 0 ? (
        <div className="px-4 py-3.5 text-sm italic text-muted-foreground/70">
          No guests yet. Add one below.
        </div>
      ) : (
        rows.map((row, i) => {
          const isLast = i === rows.length - 1;
          const isEdit = editingId === row.id;

          if (isEdit) {
            return (
              <div
                key={row.id}
                className={cn(
                  "grid grid-cols-[1fr_64px_32px] gap-2.5 items-center px-3 py-2 bg-muted/35",
                  !isLast && "border-b border-border/60",
                )}
              >
                <Input
                  ref={nameInputRef}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onKeyDown={handleNameKeyDown}
                  onBlur={(e) => handleNameBlur(row.id, e)}
                  placeholder="Guest name"
                  className="h-9 text-sm"
                />
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "text-xs",
                      draft.plus && parseInt(draft.plus, 10) > 0
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    +
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={9}
                    data-row-sibling={row.id}
                    value={draft.plus}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return setDraft((d) => ({ ...d, plus: "" }));
                      const n = parseInt(raw, 10);
                      if (isNaN(n)) return;
                      setDraft((d) => ({ ...d, plus: String(Math.max(0, Math.min(9, n))) }));
                    }}
                    onKeyDown={handlePlusKeyDown}
                    onBlur={handlePlusBlur}
                    aria-label="Additional guests"
                    className="h-9 w-11 px-1 text-center font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div />
              </div>
            );
          }

          return (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => startEdit(row)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEdit(row);
                }
              }}
              className={cn(
                "group grid grid-cols-[1fr_auto_32px] gap-2.5 items-center px-4 py-2.5",
                "cursor-text hover:bg-muted/35 transition-colors",
                !isLast && "border-b border-border/60",
              )}
            >
              <span className="text-sm text-foreground truncate">{row.name}</span>
              {row.plusOnes > 0 ? (
                <span className="font-mono text-xs text-muted-foreground">
                  +{row.plusOnes}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeWithUndo(row.id);
                }}
                aria-label={`Remove ${row.name || "guest"}`}
                className={cn(
                  "h-7 w-7 inline-flex items-center justify-center rounded-md",
                  "text-muted-foreground/70 transition-[opacity,color,background-color] duration-150 ease-out",
                  "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                  "hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100",
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })
      )}
      <button
        type="button"
        onClick={addBlankRow}
        disabled={atCapacity}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors",
          rows.length > 0 && "border-t border-border/60",
          atCapacity
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/35",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {atCapacity ? "Comp limit reached" : "Add guest"}
      </button>
    </div>
  );
}
