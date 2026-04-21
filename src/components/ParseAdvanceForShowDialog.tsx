import { useEffect, useState, useRef } from "react";
import { FileText, Loader2, Check, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Show } from "@/lib/types";
import { extractTextFromPdf } from "@/lib/pdfExtract";

const FIELD_LABELS: Record<string, string> = {
  venue_name: "Venue Name",
  venue_address: "Venue Address",
  city: "City",
  date: "Date",
  dos_contact_name: "Day of Show Contact",
  dos_contact_phone: "Day of Show Phone",
  departure_time: "Departure Time",
  departure_notes: "Departure Notes",
  parking_notes: "Parking",
  load_in_details: "Load In",
  green_room_info: "Green Room",
  guest_list_details: "Guest List",
  wifi_network: "WiFi Network",
  wifi_password: "WiFi Password",
  hotel_name: "Accommodations Name",
  hotel_address: "Accommodations Address",
  hotel_confirmation: "Accommodations Confirmation",
  hotel_checkin: "Accommodations Check-in",
  hotel_checkout: "Accommodations Check-out",
  set_length: "Set Length",
  backline_provided: "Backline Provided",
  venue_capacity: "Venue Capacity",
  ticket_price: "Ticket Price",
  guarantee: "Guarantee",
  backend_deal: "Backend Deal",
  hospitality: "Hospitality",
  walkout_potential: "Walkout Potential",
  artist_comps: "Artist Comps",
  additional_info: "Additional Info",
};

// Fields to skip from merge consideration
const SKIP_FIELDS = new Set(["schedule", "venue_name", "city", "date"]);

type PendingField = { key: string; label: string; newValue: string };

interface Props {
  showId: string;
  currentShow: Show;
  onUpdated: () => void;
  trigger?: React.ReactNode;
  /** When provided, skip the paste step and jump straight to the confirm UI
   *  using these already-parsed fields. Used by the inbound-email review flow. */
  initialParsedResult?: Record<string, unknown> | null;
  /** Controlled open state (optional). If set, overrides the internal state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the default trigger button. Useful when the dialog is opened externally. */
  hideTrigger?: boolean;
}

export default function ParseAdvanceForShowDialog({
  showId,
  currentShow,
  onUpdated,
  trigger,
  initialParsedResult,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"paste" | "confirm">("paste");
  const [pendingFields, setPendingFields] = useState<PendingField[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [parsedSchedule, setParsedSchedule] = useState<any[] | null>(null);
  const [scheduleSelected, setScheduleSelected] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setStep("paste");
    setPendingFields([]);
    setSelectedKeys(new Set());
    setParsedSchedule(null);
    setScheduleSelected(false);
    setPdfFile(null);
    setExtractingPdf(false);
    setLoading(false);
    setSaving(false);
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB)");
      return;
    }
    setPdfFile(file);
    setExtractingPdf(true);
    try {
      const extracted = await extractTextFromPdf(file);
      setText((prev) => prev ? prev + "\n\n--- PDF Content ---\n\n" + extracted : extracted);
      toast.success(`Extracted text from ${file.name}`);
    } catch (err) {
      console.error("PDF extraction error:", err);
      toast.error("Failed to extract text from PDF");
      setPdfFile(null);
    } finally {
      setExtractingPdf(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const applyParsedResult = (parsed: Record<string, unknown>) => {
    const fields: PendingField[] = [];
    for (const [key, newVal] of Object.entries(parsed)) {
      if (SKIP_FIELDS.has(key)) continue;
      if (!newVal || (typeof newVal === "string" && !newVal.trim())) continue;
      const currentVal = (currentShow as any)[key];
      if (!currentVal || (typeof currentVal === "string" && !currentVal.trim())) {
        fields.push({
          key,
          label: FIELD_LABELS[key] || key,
          newValue: String(newVal),
        });
      }
    }

    const schedule = (parsed as any).schedule;
    const hasExistingSchedule = (currentShow as any).schedule_entries?.length > 0;
    let nextSchedule: any[] | null = null;
    if (Array.isArray(schedule) && schedule.length > 0 && !hasExistingSchedule) {
      nextSchedule = schedule;
    }

    if (fields.length === 0 && !nextSchedule) {
      toast.info("No new fields found — all parsed data already exists on this show");
      return false;
    }

    setParsedSchedule(nextSchedule);
    setScheduleSelected(!!nextSchedule);
    setPendingFields(fields);
    setSelectedKeys(new Set(fields.map((f) => f.key)));
    setStep("confirm");
    return true;
  };

  // When opened with a pre-parsed result (inbound email review flow), skip
  // the paste step and jump straight to confirm.
  useEffect(() => {
    if (open && initialParsedResult && step === "paste") {
      applyParsedResult(initialParsedResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialParsedResult]);

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error("Paste text or upload a PDF first");
      return;
    }
    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "parse-advance",
        { body: { emailText: text } }
      );
      if (fnError) throw new Error(fnError.message || "Failed to parse");
      if (fnData?.error) throw new Error(fnData.error);

      const parsed = fnData.show;
      if (!parsed) throw new Error("AI could not extract show details");
      applyParsedResult(parsed);
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error(err.message || "Failed to parse");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const updates: Record<string, string> = {};
    for (const field of pendingFields) {
      if (selectedKeys.has(field.key)) {
        updates[field.key] = field.newValue;
      }
    }

    const hasUpdates = Object.keys(updates).length > 0;
    const hasSchedule = scheduleSelected && parsedSchedule && parsedSchedule.length > 0;

    if (!hasUpdates && !hasSchedule) {
      toast.info("No fields selected");
      return;
    }

    setSaving(true);
    try {
      const showUpdate: Record<string, string> = {
        ...updates,
        advance_imported_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("shows").update(showUpdate).eq("id", showId);
      if (error) throw error;

      if (hasSchedule) {
        await supabase.from("schedule_entries").delete().eq("show_id", showId);
        await supabase.from("schedule_entries").insert(
          parsedSchedule!.map((entry: any, i: number) => ({
            show_id: showId,
            time: entry.time,
            label: entry.label,
            is_band: entry.is_band ?? false,
            sort_order: i,
          }))
        );
      }

      toast.success(`Updated ${Object.keys(updates).length} field(s)`);
      onUpdated();
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-4 w-4" /> Parse Advance
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {step === "paste" ? "Import Advance" : "Confirm Updates"}
          </DialogTitle>
          <DialogDescription>
            {step === "paste"
              ? "Paste an advance email, venue tech packet, or any text with show info. You can also upload a PDF."
              : "Select which fields to update. Only empty fields are shown."}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" && (
          <div className="space-y-4 pt-2">
            {/* PDF upload zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="relative border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = "";
                }}
              />
              {extractingPdf ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Extracting text from PDF…</span>
                </div>
              ) : pdfFile ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{pdfFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPdfFile(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Drop a PDF here or <span className="text-primary underline">browse</span>
                  </span>
                </div>
              )}
            </div>

            <div className="relative flex items-center gap-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">and / or paste text</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste advance email, venue info, tech rider, or any show details..."
              className="min-h-[160px] font-mono text-sm"
            />
            <Button onClick={handleParse} disabled={loading || extractingPdf} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Parsing with AI…
                </>
              ) : (
                "Parse with AI"
              )}
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 pt-2">
            {pendingFields.length === 0 && !parsedSchedule ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No new data found to fill in.
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                {pendingFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-start gap-3 rounded-md border border-border p-3"
                  >
                    <Checkbox
                      id={`field-${field.key}`}
                      checked={selectedKeys.has(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`field-${field.key}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {field.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-0.5 break-words">
                        {field.newValue}
                      </p>
                    </div>
                  </div>
                ))}
                {parsedSchedule && parsedSchedule.length > 0 && (
                  <div className="flex items-start gap-3 rounded-md border border-border p-3">
                    <Checkbox
                      id="field-schedule"
                      checked={scheduleSelected}
                      onCheckedChange={() => setScheduleSelected(!scheduleSelected)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor="field-schedule"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Schedule ({parsedSchedule.length} entries)
                      </Label>
                      <div className="text-sm text-muted-foreground mt-0.5 space-y-0.5">
                        {parsedSchedule.map((e: any, i: number) => (
                          <div key={i}>
                            {e.time} — {e.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              {!initialParsedResult && (
                <Button variant="ghost" onClick={() => setStep("paste")}>
                  Back
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || (selectedKeys.size === 0 && !scheduleSelected)}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Update {selectedKeys.size + (scheduleSelected ? 1 : 0)} field(s)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
