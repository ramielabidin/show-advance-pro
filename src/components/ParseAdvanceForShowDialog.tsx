import { useState } from "react";
import { FileText, Loader2, Check } from "lucide-react";
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

const FIELD_LABELS: Record<string, string> = {
  venue_name: "Venue Name",
  venue_address: "Venue Address",
  city: "City",
  date: "Date",
  dos_contact_name: "Day of Show Contact",
  dos_contact_phone: "Day of Show Phone",
  departure_time: "Departure Time",
  departure_location: "Departure Location",
  parking_notes: "Parking",
  load_in_details: "Load In",
  green_room_info: "Green Room",
  guest_list_details: "Guest List",
  wifi_network: "WiFi Network",
  wifi_password: "WiFi Password",
  settlement_method: "Settlement Method",
  settlement_guarantee: "Settlement Guarantee",
  hotel_name: "Hotel Name",
  hotel_address: "Hotel Address",
  hotel_confirmation: "Hotel Confirmation",
  hotel_checkin: "Hotel Check-in",
  hotel_checkout: "Hotel Check-out",
  travel_notes: "Travel Notes",
  set_length: "Set Length",
  curfew: "Curfew",
  backline_provided: "Backline Provided",
  catering_details: "Catering",
  changeover_time: "Changeover Time",
  venue_capacity: "Venue Capacity",
  ticket_price: "Ticket Price",
  age_restriction: "Age Restriction",
  guarantee: "Guarantee",
  backend_deal: "Backend Deal",
  hospitality: "Hospitality",
  support_act: "Support Act",
  support_pay: "Support Pay",
  merch_split: "Merch Split",
  walkout_potential: "Walkout Potential",
  net_gross: "Net Gross",
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
}

export default function ParseAdvanceForShowDialog({ showId, currentShow, onUpdated, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"paste" | "confirm">("paste");
  const [pendingFields, setPendingFields] = useState<PendingField[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [parsedSchedule, setParsedSchedule] = useState<any[] | null>(null);
  const [scheduleSelected, setScheduleSelected] = useState(false);

  const reset = () => {
    setText("");
    setStep("paste");
    setPendingFields([]);
    setSelectedKeys(new Set());
    setParsedSchedule(null);
    setScheduleSelected(false);
    setLoading(false);
    setSaving(false);
  };

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error("Paste an advance email first");
      return;
    }
    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "parse-advance",
        { body: { emailText: text } }
      );
      if (fnError) throw new Error(fnError.message || "Failed to parse email");
      if (fnData?.error) throw new Error(fnData.error);

      const parsed = fnData.show;
      if (!parsed) throw new Error("AI could not extract show details");

      // Determine which fields are new (current show has null/empty, parsed has value)
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

      // Check schedule
      const schedule = parsed.schedule;
      const hasExistingSchedule = (currentShow as any).schedule_entries?.length > 0;
      if (Array.isArray(schedule) && schedule.length > 0 && !hasExistingSchedule) {
        setParsedSchedule(schedule);
        setScheduleSelected(true);
      } else {
        setParsedSchedule(null);
        setScheduleSelected(false);
      }

      if (fields.length === 0 && !parsedSchedule) {
        toast.info("No new fields found — all parsed data already exists on this show");
        return;
      }

      setPendingFields(fields);
      setSelectedKeys(new Set(fields.map((f) => f.key)));
      setStep("confirm");
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error(err.message || "Failed to parse email");
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
      if (hasUpdates) {
        const { error } = await supabase.from("shows").update(updates).eq("id", showId);
        if (error) throw error;
      }

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
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-4 w-4" /> Parse Advance
          </Button>
        )}
      </DialogTrigger>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {step === "paste" ? "Parse Advance Email" : "Confirm Updates"}
          </DialogTitle>
          <DialogDescription>
            {step === "paste"
              ? "Paste the advance email below. AI will extract details and fill in empty fields only."
              : "Select which fields to update. Only empty fields are shown."}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" && (
          <div className="space-y-4 pt-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the advance email here..."
              className="min-h-[200px] font-mono text-sm"
            />
            <Button onClick={handleParse} disabled={loading} className="w-full">
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
              <Button variant="ghost" onClick={() => setStep("paste")}>
                Back
              </Button>
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
