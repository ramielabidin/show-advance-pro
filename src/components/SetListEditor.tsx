import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Check,
  X,
  Shuffle,
  Dices,
  StickyNote,
  Music,
  Save,
  Search,
  ListMusic,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Show, Song, SetListEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import SetListPdfDialog from "@/components/SetListPdfDialog";

interface Props {
  show: Show;
}

function shuffleArr<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function entryTitle(e: SetListEntry): string {
  return e.kind === "note" ? e.text : e.title;
}

// Sortable rows need a stable string id. Entries don't carry one — derive a
// per-entry id and keep it in lockstep with the array, regenerating only when
// the user mutates the list (add / remove / reorder use the same id pool).
function entryId(e: SetListEntry, index: number): string {
  if (e.kind === "song") return `song:${e.song_id}:${index}`;
  if (e.kind === "custom") return `custom:${index}:${e.title}`;
  return `note:${index}:${e.text}`;
}

// Equality on entry arrays for the dirty check. JSON.stringify is fine here:
// entries are small and have a stable shape (no Dates, no functions).
function entriesEqual(a: SetListEntry[], b: SetListEntry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface SortableRowProps {
  id: string;
  entry: SetListEntry;
  number: number | null;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableRow({ id, entry, number, index, total, onRemove, onMoveUp, onMoveDown }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const isNote = entry.kind === "note";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-2 bg-card",
        index < total - 1 && "border-b border-border/60",
        isDragging && "relative z-10 shadow-lg ring-1 ring-foreground/10",
      )}
    >
      {/* Drag handle — long-press on touch, immediate on pointer */}
      <button
        type="button"
        aria-label="Drag to reorder"
        className="touch-none shrink-0 -ml-1 h-8 w-7 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="w-5 shrink-0 text-right">
        {isNote ? (
          <StickyNote className="h-3 w-3 text-muted-foreground ml-auto" />
        ) : (
          <span className="text-[11px] font-mono text-muted-foreground">{number}.</span>
        )}
      </div>

      <div
        className={cn(
          "flex-1 min-w-0 text-sm truncate",
          isNote ? "italic text-muted-foreground" : "text-foreground",
        )}
      >
        {entryTitle(entry)}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {/* Keyboard / a11y reorder fallback. Hidden on touch where drag is the
            primary affordance; revealed on focus-visible for keyboard users. */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hidden sm:inline-flex sm:opacity-0 focus-visible:opacity-100 sm:group-hover:opacity-100"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hidden sm:inline-flex sm:opacity-0 focus-visible:opacity-100 sm:group-hover:opacity-100"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function SetListEditor({ show }: Props) {
  const queryClient = useQueryClient();
  const seed = useMemo<SetListEntry[]>(
    () => (Array.isArray(show.set_list) ? (show.set_list as SetListEntry[]) : []),
    [show.set_list],
  );

  const [entries, setEntries] = useState<SetListEntry[]>(seed);
  const [customDraft, setCustomDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [search, setSearch] = useState("");

  // Re-seed when the saved set list changes (after save / parent refetch).
  useEffect(() => {
    setEntries(seed);
  }, [seed]);

  const dirty = useMemo(() => !entriesEqual(entries, seed), [entries, seed]);

  const { data: songs = [], isLoading: songsLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await supabase.from("songs").select("*").order("title");
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  const filteredSongs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.title.toLowerCase().includes(q));
  }, [songs, search]);

  const selectedSongIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) if (e.kind === "song") s.add(e.song_id);
    return s;
  }, [entries]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shows")
        .update({ set_list: entries })
        .eq("id", show.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", show.id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("Set list saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sensors = useSensors(
    // Touch: 200ms hold + 8px tolerance so a tap-and-scroll still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Pointer (desktop / mouse): 6px move before drag begins, so clicks on
    // the handle don't accidentally grab when the user just wanted to focus.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => entries.map((e, i) => entryId(e, i)), [entries]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    setEntries((prev) => arrayMove(prev, from, to));
  };

  const toggleSong = (song: Song) => {
    if (!selectedSongIds.has(song.id)) {
      setEntries((prev) => [...prev, { kind: "song", song_id: song.id, title: song.title }]);
    } else {
      setEntries((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const e = prev[i];
          if (e.kind === "song" && e.song_id === song.id) {
            return prev.filter((_, idx) => idx !== i);
          }
        }
        return prev;
      });
    }
    // Typeahead: clear after each pick so the user can keep typing the next song.
    setSearch("");
  };

  const commitCustom = () => {
    const t = customDraft.trim();
    if (!t) return;
    setEntries((prev) => [...prev, { kind: "custom", title: t }]);
    setCustomDraft("");
    setAddingCustom(false);
  };

  const commitNote = () => {
    const t = noteDraft.trim();
    if (!t) return;
    setEntries((prev) => [...prev, { kind: "note", text: t }]);
    setNoteDraft("");
    setAddingNote(false);
  };

  const removeAt = (i: number) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const moveUp = (i: number) =>
    setEntries((prev) => (i === 0 ? prev : arrayMove(prev, i, i - 1)));

  const moveDown = (i: number) =>
    setEntries((prev) => (i >= prev.length - 1 ? prev : arrayMove(prev, i, i + 1)));

  const shuffleSelected = () => {
    if (entries.length < 2) {
      toast.info("Add a few songs first, then shuffle.");
      return;
    }
    setEntries((prev) => shuffleArr(prev));
  };

  const randomFromCatalog = () => {
    if (songs.length === 0) {
      toast.error("Catalog is empty — add songs in Settings first.");
      return;
    }
    if (
      entries.length > 0 &&
      !window.confirm(
        `Replace your current ${entries.length}-item set with a random pick?`,
      )
    ) {
      return;
    }
    const wanted = Math.max(1, Math.floor(randomCount));
    const n = Math.min(wanted, songs.length);
    const picks = shuffleArr(songs).slice(0, n);
    setEntries(picks.map((s) => ({ kind: "song" as const, song_id: s.id, title: s.title })));
    if (n < wanted) toast.info(`Catalog has ${songs.length} songs — used all.`);
  };

  // Numbering: songs + custom entries get numbered, notes don't.
  const visibleNumber = (i: number): number => {
    let n = 0;
    for (let k = 0; k <= i; k++) {
      if (entries[k].kind !== "note") n += 1;
    }
    return n;
  };

  return (
    <div className="space-y-5">
      {/* Header — title + Save / PDF actions */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Set list · {entries.length}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <SetListPdfDialog show={show} entries={entries} />
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {/* ── Add row ──────────────────────────────────────────────
          Search is pinned at the top. The matching-songs panel only
          appears while there's a query, so an empty editor stays quiet
          and Tonight's Set isn't pushed off-screen by a full catalog. */}
      <section className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              songs.length === 0
                ? "Add songs in Settings → Song catalog"
                : `Search your ${songs.length}-song catalog`
            }
            className="h-9 pl-8"
            disabled={songs.length === 0 && !songsLoading}
          />
        </div>

        {search.trim() && (
          <div className="rounded-lg border bg-card overflow-hidden">
            {songsLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : songs.length === 0 ? (
              <div className="text-center py-6 px-4 text-muted-foreground">
                <Music className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Your catalog is empty.</p>
                <p className="text-xs mt-1">Add songs in Settings → Song catalog.</p>
              </div>
            ) : filteredSongs.length === 0 ? (
              <div className="text-center py-6 px-4 text-sm text-muted-foreground">
                No songs match "{search}".
              </div>
            ) : (
              filteredSongs.slice(0, 8).map((s, i, arr) => {
                const checked = selectedSongIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSong(s)}
                    aria-pressed={checked}
                    className={cn(
                      "flex items-center justify-between w-full text-left px-3 py-2 hover:bg-muted/60 [transition:background-color_150ms_var(--ease-out)]",
                      i < arr.length - 1 && "border-b border-border/60",
                    )}
                  >
                    <span className="text-sm text-foreground truncate">{s.title}</span>
                    {checked ? (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
            {filteredSongs.length > 8 && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border/60 bg-muted/30">
                Showing 8 of {filteredSongs.length} — keep typing to narrow down.
              </div>
            )}
          </div>
        )}

        {/* Add custom / note — always visible below the search */}
        {addingCustom ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCustom();
                else if (e.key === "Escape") {
                  setCustomDraft("");
                  setAddingCustom(false);
                }
              }}
              placeholder="Song not in catalog"
              className="h-9"
            />
            <Button size="sm" variant="outline" onClick={commitCustom} disabled={!customDraft.trim()}>
              Add
            </Button>
          </div>
        ) : addingNote ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNote();
                else if (e.key === "Escape") {
                  setNoteDraft("");
                  setAddingNote(false);
                }
              }}
              placeholder="e.g. tuning break, talk"
              className="h-9"
            />
            <Button size="sm" variant="outline" onClick={commitNote} disabled={!noteDraft.trim()}>
              Add
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={() => {
                setAddingCustom(true);
                setAddingNote(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Custom song
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={() => {
                setAddingNote(true);
                setAddingCustom(false);
              }}
            >
              <StickyNote className="h-3.5 w-3.5" />
              Note
            </Button>
          </div>
        )}
      </section>

      {/* ── Tonight's Set ─────────────────────────────────────── */}
      <section className="space-y-2">
        {/* Set actions — ghost buttons matching the Custom song / Note row
            above. Number input sits left of Random so it reads as a
            quantity (e.g. "10 Random"). */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={shuffleSelected}
          >
            <Shuffle className="h-3.5 w-3.5" />
            Shuffle
          </Button>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              value={randomCount}
              onChange={(e) => setRandomCount(Math.max(1, Number(e.target.value) || 1))}
              className="h-8 w-12 px-1.5 text-xs text-center"
              aria-label="How many random songs"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={randomFromCatalog}
            >
              <Dices className="h-3.5 w-3.5" />
              Random
            </Button>
          </div>
        </div>

        {/* Set list entries — drag to reorder */}
        <div className="rounded-lg border bg-card overflow-hidden group">
          {entries.length === 0 ? (
            <div className="text-center py-8 px-4 text-muted-foreground">
              <ListMusic className="h-7 w-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nothing picked yet.</p>
              <p className="text-xs mt-1">Search your catalog above or add a custom song.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {entries.map((e, i) => (
                  <SortableRow
                    key={ids[i]}
                    id={ids[i]}
                    entry={e}
                    number={e.kind !== "note" ? visibleNumber(i) : null}
                    index={i}
                    total={entries.length}
                    onRemove={() => removeAt(i)}
                    onMoveUp={() => moveUp(i)}
                    onMoveDown={() => moveDown(i)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </section>
    </div>
  );
}
