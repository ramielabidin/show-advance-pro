import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import DaySheetSectionPicker from "@/components/DaySheetSectionPicker";
import { ALL_SECTION_KEYS, withData, type SectionKey } from "@/lib/daysheetSections";
import type { Show } from "@/lib/types";

interface SlackPushDialogProps {
  showId: string;
  show: Show & { schedule_entries?: any[] };
  trigger?: React.ReactNode;
}

export default function SlackPushDialog({ showId, show, trigger }: SlackPushDialogProps) {
  const [open, setOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(new Set());
  const [bandMode, setBandMode] = useState(false);
  const [note, setNote] = useState("");

  const handlePush = async () => {
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-slack-daysheet", {
        body: {
          showId,
          sections: Array.from(selected),
          bandMode,
          note: note.trim() || undefined,
        },
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

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      setSelected(withData(ALL_SECTION_KEYS, show));
      setBandMode(false);
      setNote("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Send className="h-4 w-4" /> Slack
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Push Day Sheet to Slack</DialogTitle>
          <DialogDescription>Choose which sections to include in the Slack message.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <DaySheetSectionPicker
            show={show}
            selected={selected}
            onChange={setSelected}
            onBandModeChange={setBandMode}
            idPrefix="slack"
          />

          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label htmlFor="slack-note" className="text-sm text-muted-foreground">
              Personal note (optional)
            </Label>
            <Textarea
              id="slack-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note to the top of the message..."
              className="text-sm min-h-[60px]"
            />
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
