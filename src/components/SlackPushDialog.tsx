import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

const SECTIONS = [
  { key: "contact", label: "Day of Show Contact" },
  { key: "venue", label: "Venue Address" },
  { key: "departure", label: "Departure" },
  { key: "schedule", label: "Schedule" },
  { key: "band", label: "Band / Performance" },
  { key: "venueDetails", label: "Venue Details" },
  { key: "dealTerms", label: "Deal Terms" },
  { key: "production", label: "Production" },
  { key: "projections", label: "Projections" },
  { key: "parking", label: "Parking" },
  { key: "loadIn", label: "Load In" },
  { key: "greenRoom", label: "Green Room" },
  { key: "guestList", label: "Guest List" },
  { key: "wifi", label: "WiFi" },
  { key: "settlement", label: "Settlement" },
  { key: "hotel", label: "Hotel" },
  { key: "travel", label: "Travel" },
  { key: "additional", label: "Additional Info" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function SlackPushDialog({ showId }: { showId: string }) {
  const [open, setOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(
    () => new Set(SECTIONS.map((s) => s.key))
  );

  const toggle = (key: SectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === SECTIONS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(SECTIONS.map((s) => s.key)));
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-slack-daysheet", {
        body: { showId, sections: Array.from(selected) },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Day sheet pushed to Slack!");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to push to Slack");
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setSelected(new Set(SECTIONS.map((s) => s.key))); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Send className="h-4 w-4" /> Slack
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Push Day Sheet to Slack</DialogTitle>
          <DialogDescription>Choose which sections to include in the Slack message.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Checkbox
              id="select-all"
              checked={selected.size === SECTIONS.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select All
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SECTIONS.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <Checkbox
                  id={`section-${s.key}`}
                  checked={selected.has(s.key)}
                  onCheckedChange={() => toggle(s.key)}
                />
                <Label htmlFor={`section-${s.key}`} className="text-sm cursor-pointer">
                  {s.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handlePush} disabled={pushing || selected.size === 0} className="gap-1.5">
            {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to Slack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
