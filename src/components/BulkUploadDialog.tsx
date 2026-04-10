import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
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

const TEMPLATE_COLUMNS = [
  "date",
  "venue_name",
  "city",
  "venue_address",
  "dos_contact_name",
  "dos_contact_phone",
  "hotel_name",
  "hotel_address",
  "tour_name",
  "venue_capacity",
  "ticket_price",
  "age_restriction",
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
  age: "age_restriction",
  age_restriction: "age_restriction",
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

/** Remap parsed row keys using CSV_COLUMN_MAP so validation/import use canonical names */
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

interface ParsedRow {
  [key: string]: string;
}

interface ValidatedRow {
  data: ParsedRow;
  errors: string[];
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

export default function BulkUploadDialog({ defaultTourId, externalOpen, onExternalOpenChange }: { defaultTourId?: string; externalOpen?: boolean; onExternalOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [selectedTourId, setSelectedTourId] = useState(defaultTourId ?? "none");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { teamId } = useTeam();

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tours").select("id, name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

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
          const validated = normalized.map((d) => ({
            data: d,
            errors: validateRow(d),
          }));
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

      const showRows = validRows.map((r) => {
        const tourName = r.data.tour_name?.trim();
        const tourFallbackId = selectedTourId !== "none" ? selectedTourId : null;
        const tour_id = tourName ? tourNameMap.get(tourName.toLowerCase()) ?? tourFallbackId : tourFallbackId;

        // Map extra CSV columns to DB columns
        const extras: Record<string, string | null> = {};
        for (const [csvKey, dbCol] of Object.entries(CSV_COLUMN_MAP)) {
          const val = r.data[csvKey]?.trim();
          if (val) extras[dbCol] = val;
        }

        return {
          date: r.data.date.trim(),
          venue_name: r.data.venue_name.trim(),
          city: r.data.city.trim(),
          venue_address: r.data.venue_address?.trim() || null,
          dos_contact_name: r.data.dos_contact_name?.trim() || null,
          dos_contact_phone: r.data.dos_contact_phone?.trim() || null,
          hotel_name: r.data.hotel_name?.trim() || null,
          hotel_address: r.data.hotel_address?.trim() || null,
          tour_id,
          team_id: teamId,
          ...extras,
        };
      });

      const { error } = await supabase.from("shows").insert(showRows);
      if (error) throw error;
      return showRows.length;
    },
    onSuccess: (count) => {
      toast.success(`Imported ${count} show${count !== 1 ? "s" : ""}`);
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

  const reset = () => {
    setRows([]);
    setFileName("");
    setSelectedTourId(defaultTourId ?? "none");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      {!externalOpen && externalOpen !== false && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
        </DialogTrigger>
      )}
      {onExternalOpenChange == null && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" /> Import CSV
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
                <Label className="text-xs text-muted-foreground">Assign to Tour (optional)</Label>
                <Select value={selectedTourId} onValueChange={setSelectedTourId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Standalone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standalone</SelectItem>
                    {tours.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {validRows.length} ready
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
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow
                      key={i}
                      className={r.errors.length > 0 ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>{r.data.date || "—"}</TableCell>
                      <TableCell>{r.data.venue_name || "—"}</TableCell>
                      <TableCell>{r.data.city || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.data.tour_name || "—"}
                      </TableCell>
                      <TableCell>
                        {r.errors.length > 0 ? (
                          <span className="text-xs text-destructive">
                            Missing: {r.errors.join(", ")}
                          </span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <DialogFooter>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={validRows.length === 0 || importMutation.isPending}
            >
              {importMutation.isPending
                ? "Importing..."
                : `Import ${validRows.length} show${validRows.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
