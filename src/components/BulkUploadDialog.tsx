import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Papa from "papaparse";
import { Upload, Download, AlertCircle, CheckCircle2, RefreshCw, HelpCircle, X } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { resolveShowTimezoneInBackground } from "@/lib/resolveShowTimezone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const TEMPLATE_COLUMNS = [
  "date",
  "venue_name",
  "city",
  "venue_address",
  "dos_contact_name",
  "dos_contact_phone",
  "dos_contact_email",
  "hotel_name",
  "hotel_address",
  "tour_name",
  "venue_capacity",
  "ticket_price",
  "guarantee",
  "backend_deal",
  "hospitality",
  "support_act",
  "support_pay",
  "merch_split",
  "walkout_potential",
  "net_gross",
  "artist_comps",
];

// Map CSV header slugs (after transformHeader) to DB column names
const CSV_COLUMN_MAP: Record<string, string> = {
  venue: "venue_name",
  cap: "venue_capacity",
  venue_capacity: "venue_capacity",
  ticket_price: "ticket_price",
  guarantee: "guarantee",
  backend_deal: "backend_deal",
  hospitality: "hospitality",
  support_act: "support_act",
  support_pay: "support_pay",
  merch_split: "merch_split",
  walkout_potential: "walkout_potential",
  net_gross: "net_gross",
  artist_comps: "artist_comps",
};

/** Financial DB columns that should be stored as clean numbers (no $, commas, or ranges) */
const FINANCIAL_FIELDS = new Set([
  "guarantee",
  "walkout_potential",
  "net_gross",
  "ticket_price",
  "support_pay",
  "venue_capacity",
  "artist_comps",
  "merch_split",
]);

/**
 * Short labels for importable fields that aren't called out in the preview
 * table's dedicated columns (Date/Venue/City/Tour). Used to show which
 * extras each CSV row is carrying, so users can confirm their financials,
 * contact info, etc. are actually coming through.
 */
const EXTRAS_LABELS: Record<string, string> = {
  venue_address: "Address",
  dos_contact_name: "Contact",
  dos_contact_phone: "Phone",
  dos_contact_email: "Email",
  hotel_name: "Hotel",
  hotel_address: "Hotel addr",
  venue_capacity: "Capacity",
  ticket_price: "Ticket $",
  guarantee: "Guarantee",
  backend_deal: "Backend",
  hospitality: "Hospitality",
  support_act: "Support",
  support_pay: "Support $",
  merch_split: "Merch",
  walkout_potential: "Walkout",
  net_gross: "Net",
  artist_comps: "Comps",
};

/** Returns the ordered list of populated extras for a parsed row. */
function extrasForRow(row: ParsedRow): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const dbCol of Object.keys(EXTRAS_LABELS)) {
    if (seen.has(dbCol)) continue;
    const direct = row[dbCol]?.trim();
    if (direct) {
      seen.add(dbCol);
      labels.push(EXTRAS_LABELS[dbCol]);
    }
  }
  return labels;
}

/**
 * Strip currency symbols, commas, and spaces from a financial string.
 * For ranges like "$20/$25", takes the first value.
 * Returns null if the result is not a valid number.
 */
export function cleanFinancialField(val: string | undefined): string | null {
  if (!val || !val.trim()) return null;
  const first = val.trim().split("/")[0];
  const cleaned = first.replace(/[^0-9.]/g, "");
  if (!cleaned || isNaN(parseFloat(cleaned))) return null;
  return cleaned;
}

/**
 * Normalize a backend deal string from a spreadsheet into the canonical format
 * our parsers expect: "{pct}% of {GBOR|NBOR}" or "{pct}% of {GBOR|NBOR} (plus)"
 * optionally followed by ", then {pct2}% above {N} tickets".
 *
 * If no percentage is found the raw string is returned unchanged so free-text
 * notes like "see contract" are preserved.
 */
export function normalizeBackendDeal(raw: string): string {
  const pctMatch = raw.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!pctMatch) return raw;

  const pct = parseFloat(pctMatch[1]);
  const pctStr = pct % 1 === 0 ? String(Math.round(pct)) : String(pct);
  const basis = /NBOR/i.test(raw) ? "NBOR" : "GBOR";

  // Detect "plus" in any of its common spreadsheet spellings
  const isPlus = /\(plus\)/i.test(raw) || /(^|[\s+&,])plus($|[\s,])/i.test(raw);
  const plusTag = isPlus ? " (plus)" : "";

  // Preserve a second tier if it's already in the canonical format
  const tierMatch = raw.match(/then\s+(\d{1,3}(?:\.\d+)?)\s*%\s+above\s+(\d+)\s*tickets?/i);
  let deal = `${pctStr}% of ${basis}${plusTag}`;
  if (tierMatch) {
    const t2Pct = parseFloat(tierMatch[1]);
    const t2Thresh = parseInt(tierMatch[2], 10);
    if (!isNaN(t2Pct) && !isNaN(t2Thresh)) {
      const t2Str = t2Pct % 1 === 0 ? String(Math.round(t2Pct)) : String(t2Pct);
      deal += `, then ${t2Str}% above ${t2Thresh} tickets`;
    }
  }
  return deal;
}


function normalizeRow(raw: ParsedRow): ParsedRow {
  const out: ParsedRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = CSV_COLUMN_MAP[key] ?? key;
    out[mapped] = value;
  }
  return out;
}

/** Detect preamble / junk rows that sneak in before the real header */
function isJunkRow(row: ParsedRow): boolean {
  const hasDate = row.date?.trim() && !isNaN(Date.parse(row.date.trim()));
  const hasVenue = !!(row.venue_name?.trim() || row.venue?.trim());
  return !hasDate && !hasVenue;
}

const REQUIRED = ["date", "venue_name", "city"] as const;

/** Fuzzy match threshold — venue similarity above this is flagged for review */
const FUZZY_THRESHOLD = 0.85;

/** Show fields never overwritten on update — these are post-show data */
const PROTECTED_FIELDS = new Set([
  "is_settled",
  "actual_walkout",
  "actual_tickets_sold",
  "settlement_notes",
]);

interface ParsedRow {
  [key: string]: string;
}

interface ExistingShow {
  id: string;
  date: string;
  venue_name: string;
}

type MatchStatus =
  | { kind: "insert" }
  | { kind: "update"; showId: string; existingVenueName: string }
  | {
      kind: "review";
      showId: string;
      existingVenueName: string;
      similarity: number;
    };

interface ValidatedRow {
  data: ParsedRow;
  errors: string[];
  match: MatchStatus;
  /** User override for review rows: "confirm" treats as update, "reject" treats as insert */
  override?: "confirm" | "reject";
}

/** Levenshtein edit distance, iterative two-row DP */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[b.length];
}

/** Normalize venue names for comparison: lowercase, collapse non-alphanumerics */
function normalizeVenueName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function venueSimilarity(a: string, b: string): number {
  const na = normalizeVenueName(a);
  const nb = normalizeVenueName(b);
  if (!na.length || !nb.length) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

/** Coerce various date strings to ISO (YYYY-MM-DD) for matching against DB dates */
function normalizeDate(s: string): string | null {
  const trimmed = s?.trim();
  if (!trimmed) return null;
  const t = Date.parse(trimmed);
  if (isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Compute match status for a parsed row against the pool of existing team shows */
function computeMatch(row: ParsedRow, existing: ExistingShow[]): MatchStatus {
  const isoDate = normalizeDate(row.date);
  const venue = row.venue_name?.trim();
  if (!isoDate || !venue) return { kind: "insert" };

  const sameDate = existing.filter((s) => s.date === isoDate);
  if (sameDate.length === 0) return { kind: "insert" };

  // Exact venue match (case-insensitive, whitespace tolerant)
  const normIncoming = normalizeVenueName(venue);
  const exact = sameDate.find(
    (s) => normalizeVenueName(s.venue_name) === normIncoming
  );
  if (exact) {
    return {
      kind: "update",
      showId: exact.id,
      existingVenueName: exact.venue_name,
    };
  }

  // Fuzzy — pick best candidate on the same date
  let best: { show: ExistingShow; sim: number } | null = null;
  for (const s of sameDate) {
    const sim = venueSimilarity(venue, s.venue_name);
    if (!best || sim > best.sim) best = { show: s, sim };
  }
  if (best && best.sim >= FUZZY_THRESHOLD) {
    return {
      kind: "review",
      showId: best.show.id,
      existingVenueName: best.show.venue_name,
      similarity: best.sim,
    };
  }

  return { kind: "insert" };
}

function validateRow(row: ParsedRow): string[] {
  const errors: string[] = [];
  for (const field of REQUIRED) {
    if (!row[field]?.trim()) errors.push(field);
  }
  if (row.date?.trim() && isNaN(Date.parse(row.date.trim()))) {
    errors.push("date (invalid)");
  }
  return errors;
}

function downloadTemplate() {
  const csv = TEMPLATE_COLUMNS.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shows_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkUploadDialog({ defaultTourId, externalOpen, onExternalOpenChange, triggerClassName, iconOnlyMobile }: { defaultTourId?: string; externalOpen?: boolean; onExternalOpenChange?: (open: boolean) => void; triggerClassName?: string; iconOnlyMobile?: boolean }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [selectedTourId, setSelectedTourId] = useState(defaultTourId ?? "none");
  const [creatingTour, setCreatingTour] = useState(false);
  const [newTourName, setNewTourName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { teamId } = useTeam();

  const { data: tours = [] } = useQuery({
    queryKey: ["tours", "names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tours").select("id, name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: existingShows = [] } = useQuery({
    queryKey: ["shows", "bulk-match", teamId],
    queryFn: async (): Promise<ExistingShow[]> => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, date, venue_name")
        .eq("team_id", teamId);
      if (error) throw error;
      return data as ExistingShow[];
    },
    enabled: open && !!teamId,
  });

  // Recompute match status whenever existing shows arrive after rows are parsed
  useEffect(() => {
    if (!rows.length) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        match: r.errors.length > 0 ? { kind: "insert" } : computeMatch(r.data, existingShows),
        // Drop stale override if the underlying match no longer needs review
        override: undefined,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingShows]);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  /** Effective action per row, after user overrides on review rows */
  const resolveAction = (r: ValidatedRow): "insert" | "update" | "review" => {
    if (r.match.kind === "insert") return "insert";
    if (r.match.kind === "update") return "update";
    if (r.override === "confirm") return "update";
    if (r.override === "reject") return "insert";
    return "review";
  };

  const counts = useMemo(() => {
    let insert = 0, update = 0, review = 0;
    for (const r of validRows) {
      const a = resolveAction(r);
      if (a === "insert") insert++;
      else if (a === "update") update++;
      else review++;
    }
    return { insert, update, review };
  }, [validRows]);

  const setRowOverride = (index: number, override: "confirm" | "reject" | undefined) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, override } : r)));
  };

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);

    // Read file as text first so we can skip preamble rows before the real header
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      // Find the header row: first line containing "date" as a field
      const lines = text.split(/\r?\n/);
      let headerIdx = 0;
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        if (lines[i].toLowerCase().split(",").some((h) => h.trim() === "date")) {
          headerIdx = i;
          break;
        }
      }
      const trimmedCsv = lines.slice(headerIdx).join("\n");

      Papa.parse<ParsedRow>(trimmedCsv, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
        complete: (results) => {
          const normalized = results.data
            .map(normalizeRow)
            .filter((d) => !isJunkRow(d));
          const validated: ValidatedRow[] = normalized.map((d) => {
            const errors = validateRow(d);
            return {
              data: d,
              errors,
              match: errors.length > 0 ? { kind: "insert" } : computeMatch(d, existingShows),
            };
          });
          setRows(validated);
        },
      });
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const importMutation = useMutation({
    mutationFn: async () => {
      // Partition rows by effective action — review rows without an override
      // shouldn't reach here (button is disabled), but treat them as insert defensively.
      const toInsert: ValidatedRow[] = [];
      const toUpdate: { row: ValidatedRow; showId: string }[] = [];
      for (const r of validRows) {
        const action = resolveAction(r);
        if (action === "update" && r.match.kind !== "insert") {
          toUpdate.push({ row: r, showId: r.match.showId });
        } else {
          toInsert.push(r);
        }
      }

      const tourNameMap = new Map(tours.map((t) => [t.name.toLowerCase(), t.id]));
      const newTourNames = new Set<string>();
      for (const r of validRows) {
        const name = r.data.tour_name?.trim();
        if (name && !tourNameMap.has(name.toLowerCase())) {
          newTourNames.add(name);
        }
      }

      // Create missing tours
      if (newTourNames.size > 0) {
        const { data: created, error } = await supabase
          .from("tours")
          .insert([...newTourNames].map((name) => ({ name, team_id: teamId })))
          .select("id, name");
        if (error) throw error;
        created?.forEach((t) => tourNameMap.set(t.name.toLowerCase(), t.id));
      }

      const allMappedDbCols = new Set(Object.values(CSV_COLUMN_MAP));

      const buildPayload = (r: ValidatedRow, forUpdate: boolean) => {
        const tourName = r.data.tour_name?.trim();
        const tourFallbackId = selectedTourId !== "none" ? selectedTourId : null;
        const tour_id = tourName ? tourNameMap.get(tourName.toLowerCase()) ?? tourFallbackId : tourFallbackId;

        // First non-empty raw value per DB column (CSV_COLUMN_MAP has aliases)
        const rawByDbCol = new Map<string, string>();
        for (const [csvKey, dbCol] of Object.entries(CSV_COLUMN_MAP)) {
          const raw = r.data[csvKey]?.trim();
          if (raw && !rawByDbCol.has(dbCol)) rawByDbCol.set(dbCol, raw);
        }

        const extras: Record<string, string | null> = {};
        for (const dbCol of allMappedDbCols) {
          if (PROTECTED_FIELDS.has(dbCol)) continue;
          const raw = rawByDbCol.get(dbCol);
          if (!raw) {
            // On update, blank CSV cells clear the field. On insert, null is the default anyway.
            if (forUpdate) extras[dbCol] = null;
            continue;
          }
          if (FINANCIAL_FIELDS.has(dbCol)) {
            extras[dbCol] = cleanFinancialField(raw);
          } else if (dbCol === "backend_deal") {
            extras[dbCol] = normalizeBackendDeal(raw);
          } else {
            extras[dbCol] = raw;
          }
        }

        const base: Record<string, string | null> = {
          date: r.data.date.trim(),
          venue_name: r.data.venue_name.trim(),
          city: r.data.city.trim(),
          venue_address: r.data.venue_address?.trim() || null,
          hotel_name: r.data.hotel_name?.trim() || null,
          hotel_address: r.data.hotel_address?.trim() || null,
          tour_id,
          ...extras,
        };

        if (!forUpdate) base.team_id = teamId;
        return base;
      };

      // Pull DOS contact fields out of the CSV row into a separate payload for
      // the `show_contacts` table. Empty strings -> no contact to insert.
      const dosContactFor = (r: ValidatedRow) => {
        const name = r.data.dos_contact_name?.trim();
        const phone = r.data.dos_contact_phone?.trim();
        const email = r.data.dos_contact_email?.trim();
        if (!name && !phone && !email) return null;
        return {
          name: name || "",
          phone: phone || null,
          email: email || null,
          role: "day_of_show",
          role_label: null,
          sort_order: 0,
        };
      };

      if (toInsert.length > 0) {
        const insertRows = toInsert.map((r) => buildPayload(r, false));
        const { data: inserted, error } = await supabase
          .from("shows")
          .insert(insertRows)
          .select("id, venue_name, date");
        if (error) throw error;

        // Insert day-of-show contacts for any rows that had contact columns.
        // Match the returned rows to the source rows by (venue_name + date) — the
        // same pair we enforce as unique per team. Preserve the CSV row order.
        if (inserted && inserted.length > 0) {
          const idByKey = new Map(
            inserted.map((s) => [`${s.venue_name}|${s.date}`, s.id]),
          );
          const contactRows: Record<string, unknown>[] = [];
          for (const r of toInsert) {
            const dos = dosContactFor(r);
            if (!dos) continue;
            const showId = idByKey.get(`${r.data.venue_name.trim()}|${r.data.date.trim()}`);
            if (!showId) continue;
            contactRows.push({ ...dos, show_id: showId });
          }
          if (contactRows.length > 0) {
            const { error: contactErr } = await supabase.from("show_contacts").insert(contactRows);
            if (contactErr) throw contactErr;
          }

          for (const r of toInsert) {
            const showId = idByKey.get(`${r.data.venue_name.trim()}|${r.data.date.trim()}`);
            if (!showId) continue;
            resolveShowTimezoneInBackground({
              showId,
              venue_address: r.data.venue_address?.trim() || null,
              city: r.data.city?.trim() || null,
              venue_name: r.data.venue_name.trim(),
            });
          }
        }
      }

      for (const { row, showId } of toUpdate) {
        const payload = buildPayload(row, true);
        const { error } = await supabase
          .from("shows")
          .update(payload)
          .eq("id", showId)
          .eq("team_id", teamId);
        if (error) throw error;

        // When the CSV provides contact info on an update, replace this show's
        // existing day-of-show contact. Leave other roles (promoter, production,
        // etc.) untouched. If the CSV cells are blank, do not delete anything —
        // the plan is conservative about wiping user-edited contacts.
        const dos = dosContactFor(row);
        if (dos) {
          await supabase
            .from("show_contacts")
            .delete()
            .eq("show_id", showId)
            .eq("role", "day_of_show");
          const { error: contactErr } = await supabase
            .from("show_contacts")
            .insert({ ...dos, show_id: showId });
          if (contactErr) throw contactErr;
        }
      }

      return { inserted: toInsert.length, updated: toUpdate.length };
    },
    onSuccess: ({ inserted, updated }) => {
      const parts: string[] = [];
      if (inserted > 0) parts.push(`Imported ${inserted} new show${inserted !== 1 ? "s" : ""}`);
      if (updated > 0) parts.push(`Updated ${updated}`);
      toast.success(parts.join(" · ") || "Nothing to import");
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      if (defaultTourId) queryClient.invalidateQueries({ queryKey: ["tour", defaultTourId] });
      setRows([]);
      setFileName("");
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Import failed: " + err.message);
    },
  });

  const createTourMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Tour name required");
      const { data, error } = await supabase
        .from("tours")
        .insert({ name: trimmed, team_id: teamId })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (tour) => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      setSelectedTourId(tour.id);
      setCreatingTour(false);
      setNewTourName("");
      toast.success("Tour created");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create tour"),
  });

  const reset = () => {
    setRows([]);
    setFileName("");
    setSelectedTourId(defaultTourId ?? "none");
    setCreatingTour(false);
    setNewTourName("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      {onExternalOpenChange == null && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-11 sm:h-9", iconOnlyMobile && "w-9 px-0 sm:w-auto sm:px-3", triggerClassName)}
            aria-label={iconOnlyMobile ? "Import CSV" : undefined}
          >
            <Upload className={cn("h-4 w-4", iconOnlyMobile ? "sm:mr-1" : "mr-1")} />
            <span className={cn(iconOnlyMobile && "hidden sm:inline")}>Import CSV</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Shows</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple shows at once.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-4">
            {!defaultTourId && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {creatingTour ? "New tour name" : "Assign to Tour (optional)"}
                </Label>
                {creatingTour ? (
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      value={newTourName}
                      onChange={(e) => setNewTourName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newTourName.trim() && !createTourMutation.isPending) {
                            createTourMutation.mutate(newTourName);
                          }
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setCreatingTour(false);
                          setNewTourName("");
                        }
                      }}
                      placeholder="e.g. Summer 2026 Tour"
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => createTourMutation.mutate(newTourName)}
                      disabled={!newTourName.trim() || createTourMutation.isPending}
                    >
                      {createTourMutation.isPending ? "Creating…" : "Create & Import"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingTour(false);
                        setNewTourName("");
                      }}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Cancel new tour"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Select
                    value={selectedTourId}
                    onValueChange={(v) => {
                      if (v === "__create_new__") {
                        setCreatingTour(true);
                        setNewTourName("");
                      } else {
                        setSelectedTourId(v);
                      }
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Standalone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Standalone</SelectItem>
                      {tours.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                      <SelectItem value="__create_new__">+ Create new tour</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop a CSV file here, or click to browse
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <button
              onClick={downloadTemplate}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" /> Download template CSV
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{fileName}</span>
              <div className="flex items-center gap-3">
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> {invalidCount} invalid
                  </span>
                )}
                {counts.review > 0 && (
                  <span className="flex items-center gap-1 text-[var(--pastel-yellow-fg)]">
                    <HelpCircle className="h-3.5 w-3.5" /> {counts.review} review
                  </span>
                )}
                {counts.update > 0 && (
                  <span className="flex items-center gap-1 text-[var(--pastel-green-fg)]">
                    <RefreshCw className="h-3.5 w-3.5" /> {counts.update} update
                  </span>
                )}
                <span className="flex items-center gap-1 text-[var(--pastel-green-fg)]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {counts.insert} new
                </span>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="border rounded-md overflow-auto max-h-[45vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Tour</TableHead>
                    <TableHead>Extras</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const action = r.errors.length > 0 ? "invalid" : resolveAction(r);
                    const rowClass =
                      action === "invalid"
                        ? "bg-destructive/5"
                        : action === "review"
                        ? "bg-pastel-yellow/30"
                        : "";
                    const extras = extrasForRow(r.data);
                    return (
                      <TableRow key={i} className={rowClass}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{r.data.date || "—"}</TableCell>
                        <TableCell>{r.data.venue_name || "—"}</TableCell>
                        <TableCell>{r.data.city || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.data.tour_name || "—"}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[220px]">
                          {extras.length > 0 ? extras.join(" · ") : "—"}
                        </TableCell>
                        <TableCell>
                          {action === "invalid" ? (
                            <span className="text-xs text-destructive">
                              Missing: {r.errors.join(", ")}
                            </span>
                          ) : action === "update" ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1 text-xs text-[var(--pastel-green-fg)]">
                                <RefreshCw className="h-3.5 w-3.5" /> Update
                              </span>
                              {r.match.kind !== "insert" && (
                                <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                  matches: {r.match.existingVenueName}
                                </span>
                              )}
                            </div>
                          ) : action === "review" && r.match.kind === "review" ? (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1 text-xs text-[var(--pastel-yellow-fg)]">
                                <HelpCircle className="h-3.5 w-3.5" /> Probable match — review
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                incoming: <span className="text-foreground">{r.data.venue_name}</span>
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                existing: <span className="text-foreground">{r.match.existingVenueName}</span>
                                <span className="ml-1 text-muted-foreground/70">
                                  ({Math.round(r.match.similarity * 100)}%)
                                </span>
                              </span>
                              <div className="flex gap-1 pt-0.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setRowOverride(i, "confirm")}
                                >
                                  Confirm match
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setRowOverride(i, "reject")}
                                >
                                  Import as new
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-[var(--pastel-green-fg)]" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <DialogFooter>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={
                validRows.length === 0 ||
                importMutation.isPending ||
                counts.review > 0
              }
            >
              {importMutation.isPending
                ? "Importing..."
                : (() => {
                    const parts: string[] = [];
                    if (counts.insert > 0) parts.push(`Import ${counts.insert} new`);
                    if (counts.update > 0) parts.push(`Update ${counts.update}`);
                    if (counts.review > 0)
                      parts.push(
                        `${counts.review} need${counts.review !== 1 ? "" : "s"} review`
                      );
                    return parts.length ? parts.join(" · ") : "Import";
                  })()}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
