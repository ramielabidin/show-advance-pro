import { useEffect, useState } from "react";
import { Loader2, Check, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { GuestEntry } from "@/components/GuestListEditor";

type ParsedGuest = { name: string; plusOnes: number };
type ReviewRow = ParsedGuest & { id: string; selected: boolean };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingGuests: GuestEntry[];
  /** Optional comp cap (already-parsed integer). When set, the dialog warns
   *  if the merged total would exceed it but still allows the user through. */
  cap?: number | null;
  onConfirm: (entriesToAdd: GuestEntry[]) => void;
}

let rowIdCounter = 0;
const newRowId = () => `pgl-${Date.now()}-${++rowIdCounter}`;

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export default function PasteGuestListDialog({
  open,
  onOpenChange,
  existingGuests,
  cap,
  onConfirm,
}: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const reset = () => {
    setText("");
    setStep("paste");
    setRows([]);
    setDuplicateCount(0);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const runParse = async () => {
    if (!text.trim()) {
      toast.error("Paste a list of names first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-guest-list", {
        body: { text },
      });
      if (error) throw new Error(error.message || "Failed to parse");
      if (data?.error) throw new Error(data.error);

      const guests: ParsedGuest[] = Array.isArray(data?.guests)
        ? data.guests
            .filter(
              (g: { name?: unknown }) =>
                g && typeof g.name === "string" && g.name.trim().length > 0,
            )
            .map((g: { name: string; plus_ones?: number }) => ({
              name: g.name.trim(),
              plusOnes: Math.max(0, Math.min(9, Math.floor(g.plus_ones ?? 0))),
            }))
        : [];

      if (guests.length === 0) {
        toast.info("No names found in that text");
        return;
      }

      const existingNames = new Set(existingGuests.map((g) => normalizeName(g.name)));
      const seen = new Set<string>();
      let dupes = 0;
      const reviewRows: ReviewRow[] = [];
      for (const g of guests) {
        const norm = normalizeName(g.name);
        if (!norm) continue;
        if (existingNames.has(norm) || seen.has(norm)) {
          dupes++;
          continue;
        }
        seen.add(norm);
        reviewRows.push({ ...g, id: newRowId(), selected: true });
      }

      if (reviewRows.length === 0) {
        toast.info(
          dupes > 0
            ? "All parsed names are already on the list"
            : "No names found in that text",
        );
        return;
      }

      setRows(reviewRows);
      setDuplicateCount(dupes);
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) =>
    setRows((curr) =>
      curr.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)),
    );

  const setAllSelected = (selected: boolean) =>
    setRows((curr) => curr.map((r) => ({ ...r, selected })));

  const selectedRows = rows.filter((r) => r.selected);
  const selectedSpots = selectedRows.reduce((sum, r) => sum + 1 + r.plusOnes, 0);
  const existingSpots = existingGuests.reduce((sum, g) => sum + 1 + g.plusOnes, 0);
  const projectedTotal = existingSpots + selectedSpots;
  const overCap = cap != null && projectedTotal > cap;

  const handleConfirm = () => {
    if (selectedRows.length === 0) {
      toast.info("Select at least one guest");
      return;
    }
    onConfirm(
      selectedRows.map((r) => ({ name: r.name, plusOnes: r.plusOnes })),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "paste" ? "Paste guest list" : "Review guests"}
          </DialogTitle>
          <DialogDescription>
            {step === "paste"
              ? "Paste names from anywhere — a Slack thread, a CSV, an email. The AI will clean it up."
              : `${rows.length} name${rows.length === 1 ? "" : "s"} parsed${
                  duplicateCount > 0
                    ? ` · ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} skipped`
                    : ""
                }.`}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" && (
          <div className="space-y-4 pt-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"e.g.\nJohn Smith +1\nJane Doe plus 2\nMike Reynolds"}
              className="min-h-[200px] font-mono text-sm"
              autoFocus
            />
            <Button onClick={runParse} disabled={loading} className="w-full gap-1.5">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Parsing with AI…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Parse with AI
                </>
              )}
            </Button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {selectedRows.length} selected · {selectedSpots} spot
                {selectedSpots === 1 ? "" : "s"} with +1s
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAllSelected(true)}
                  className="hover:text-foreground transition-colors"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setAllSelected(false)}
                  className="hover:text-foreground transition-colors"
                >
                  None
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-md border border-border divide-y divide-border/60">
              {rows.map((row) => (
                <label
                  key={row.id}
                  htmlFor={`pgl-${row.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/35 transition-colors"
                >
                  <Checkbox
                    id={`pgl-${row.id}`}
                    checked={row.selected}
                    onCheckedChange={() => toggleRow(row.id)}
                  />
                  <span className="flex-1 text-sm truncate">{row.name}</span>
                  {row.plusOnes > 0 && (
                    <span className="font-mono text-xs text-muted-foreground">
                      +{row.plusOnes}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {overCap && (
              <div className="flex items-start gap-2 rounded-md border border-[var(--pastel-yellow-fg)]/40 bg-[var(--pastel-yellow-fg)]/5 px-3 py-2 text-xs text-[var(--pastel-yellow-fg)]">
                <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
                <span>
                  Adding these will put you at {projectedTotal} of {cap} comp
                  spots. You can still proceed.
                </span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setStep("paste")}>
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedRows.length === 0}
                className="gap-1.5"
              >
                <Check className="h-4 w-4" />
                Add {selectedRows.length} guest{selectedRows.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
