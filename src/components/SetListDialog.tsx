import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Shuffle,
  Dices,
  StickyNote,
  Music,
  Save,
  Search,
  ListMusic,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Show, Song, SetListEntry } from "@/lib/types";
import { cn, formatCityState } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import SetListPdfDialog from "@/components/SetListPdfDialog";

interface Props {
  show: Show;
  trigger?: React.ReactNode;
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

export default function SetListDialog({ show, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SetListEntry[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Seed local state from show on open; reset on close.
  useEffect(() => {
    if (open) {
      const seed = Array.isArray(show.set_list) ? (show.set_list as SetListEntry[]) : [];
      setEntries(seed);
      setCustomDraft("");
      setNoteDraft("");
      setAddingCustom(false);
      setAddingNote(false);
      setSearch("");
    }
  }, [open, show.set_list]);

  const { data: songs = [], isLoading: songsLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Song[];
    },
    enabled: open,
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
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleSong = (song: Song) => {
    if (!selectedSongIds.has(song.id)) {
      setEntries((prev) => [...prev, { kind: "song", song_id: song.id, title: song.title }]);
      return;
    }
    setEntries((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        const e = prev[i];
        if (e.kind === "song" && e.song_id === song.id) {
          return prev.filter((_, idx) => idx !== i);
        }
      }
      return prev;
    });
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

  const moveUp = (i: number) => {
    if (i === 0) return;
    setEntries((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  };

  const moveDown = (i: number) => {
    if (i >= entries.length - 1) return;
    setEntries((prev) => {
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };

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
    setEntries(
      picks.map((s) => ({ kind: "song" as const, song_id: s.id, title: s.title })),
    );
    if (n < wanted) {
      toast.info(`Catalog has ${songs.length} songs — used all.`);
    }
  };

  const dateStr = useMemo(() => {
    try {
      return format(parseISO(show.date), "EEEE, MMMM d, yyyy");
    } catch {
      return show.date;
    }
  }, [show.date]);

  const cityStr = formatCityState(show.city);

  // Numbering helper: song + custom entries get numbered; notes don't.
  const visibleNumber = (i: number) => {
    let n = 0;
    for (let k = 0; k <= i; k++) {
      if (entries[k].kind !== "note") n += 1;
    }
    return n;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={(e) => { e.preventDefault(); setOpen(true); }}>
          {trigger}
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <ListMusic className="h-4 w-4" />
          Set List
        </Button>
      )}
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set List</DialogTitle>
          <DialogDescription>
            {show.venue_name}
            {cityStr ? ` · ${cityStr}` : ""} · {dateStr}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "grid gap-5 md:grid-cols-2 md:gap-6 pt-2",
            isMobile && "flex flex-col-reverse",
          )}
        >
          {/* ── Catalog ─────────────────────────────────────────────── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                Catalog · {search.trim() ? `${filteredSongs.length} of ${songs.length}` : songs.length}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalog"
                className="h-9 pl-8"
              />
            </div>

            <div className="rounded-lg border bg-card overflow-hidden max-h-[360px] overflow-y-auto">
              {isMobile && !search.trim() && songs.length > 0 ? (
                <div className="text-center py-8 px-4 text-sm text-muted-foreground">
                  Search your catalog of {songs.length} songs.
                </div>
              ) : songsLoading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
                  ))}
                </div>
              ) : songs.length === 0 ? (
                <div className="text-center py-8 px-4 text-muted-foreground">
                  <Music className="h-7 w-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Your catalog is empty.</p>
                  <p className="text-xs mt-1">
                    Add songs in Settings → Song catalog.
                  </p>
                </div>
              ) : filteredSongs.length === 0 ? (
                <div className="text-center py-8 px-4 text-sm text-muted-foreground">
                  No songs match "{search}".
                </div>
              ) : (
                filteredSongs.map((s, i) => {
                  const checked = selectedSongIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSong(s)}
                      aria-pressed={checked}
                      className={cn(
                        "flex items-center justify-between w-full text-left px-3 py-2 hover:bg-muted/60 [transition:background-color_150ms_var(--ease-out)]",
                        i < filteredSongs.length - 1 && "border-b border-border/60",
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
            </div>
          </section>

          {/* ── Tonight's Set ───────────────────────────────────────── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                Tonight's set · {entries.length}
              </span>
            </div>

            {/* Randomize controls */}
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs"
                onClick={shuffleSelected}
              >
                <Shuffle className="h-3.5 w-3.5" />
                Shuffle
              </Button>
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  value={randomCount}
                  onChange={(e) => setRandomCount(Math.max(1, Number(e.target.value) || 1))}
                  className="h-8 w-14 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs"
                  onClick={randomFromCatalog}
                >
                  <Dices className="h-3.5 w-3.5" />
                  Random from catalog
                </Button>
              </div>
            </div>

            {/* Set list entries */}
            <div className="rounded-lg border bg-card overflow-hidden max-h-[360px] overflow-y-auto">
              {entries.length === 0 ? (
                <div className="text-center py-8 px-4 text-muted-foreground">
                  <ListMusic className="h-7 w-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nothing picked yet.</p>
                  <p className="text-xs mt-1">Pick from your catalog or add a custom song.</p>
                </div>
              ) : (
                entries.map((e, i) => {
                  const isNote = e.kind === "note";
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2",
                        i < entries.length - 1 && "border-b border-border/60",
                      )}
                    >
                      <div className="w-6 shrink-0 text-right">
                        {isNote ? (
                          <StickyNote className="h-3 w-3 text-muted-foreground ml-auto" />
                        ) : (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {visibleNumber(i)}.
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex-1 min-w-0 text-sm truncate",
                          isNote ? "italic text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {entryTitle(e)}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveUp(i)}
                          disabled={i === 0}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveDown(i)}
                          disabled={i === entries.length - 1}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAt(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add custom / note */}
            <div className="space-y-2">
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
                    onClick={() => { setAddingCustom(true); setAddingNote(false); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Custom song
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-muted-foreground"
                    onClick={() => { setAddingNote(true); setAddingCustom(false); }}
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    Note
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Footer actions ─────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/60">
          <SetListPdfDialog show={show} entries={entries} />
          <Button
            className="gap-1.5 h-11 sm:h-9"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
