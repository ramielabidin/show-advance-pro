import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PasteAdvanceDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

      if (fnError) {
        throw new Error(fnError.message || "Failed to parse email");
      }

      if (fnData?.error) {
        throw new Error(fnData.error);
      }

      const parsed = fnData.show;
      if (!parsed?.venue_name || !parsed?.city || !parsed?.date) {
        throw new Error("AI could not extract required fields (venue, city, date)");
      }

      // Check if a show already exists with this venue + date
      const { data: existingShows } = await supabase
        .from("shows")
        .select("id")
        .eq("venue_name", parsed.venue_name)
        .eq("date", parsed.date)
        .limit(1);

      const schedule = parsed.schedule || [];
      delete parsed.schedule;

      if (existingShows && existingShows.length > 0) {
        // Update existing show
        const showId = existingShows[0].id;
        const { error: updateError } = await supabase
          .from("shows")
          .update({ ...parsed, is_reviewed: false })
          .eq("id", showId);

        if (updateError) throw updateError;

        // Replace schedule entries
        await supabase.from("schedule_entries").delete().eq("show_id", showId);
        if (schedule.length > 0) {
          await supabase.from("schedule_entries").insert(
            schedule.map((entry: any, i: number) => ({
              show_id: showId,
              time: entry.time,
              label: entry.label,
              is_band: entry.is_band ?? false,
              sort_order: i,
            }))
          );
        }

        queryClient.invalidateQueries({ queryKey: ["shows"] });
        queryClient.invalidateQueries({ queryKey: ["show", showId] });
        setOpen(false);
        setText("");
        toast.success("Existing show updated — tap to review", {
          action: { label: "View", onClick: () => navigate(`/shows/${showId}`) },
        });
      } else {
        // Create new show
        const { data: newShow, error: insertError } = await supabase
          .from("shows")
          .insert({ ...parsed, is_reviewed: false })
          .select()
          .single();

        if (insertError || !newShow) throw insertError || new Error("Failed to create show");

        if (schedule.length > 0) {
          await supabase.from("schedule_entries").insert(
            schedule.map((entry: any, i: number) => ({
              show_id: newShow.id,
              time: entry.time,
              label: entry.label,
              is_band: entry.is_band ?? false,
              sort_order: i,
            }))
          );
        }

        queryClient.invalidateQueries({ queryKey: ["shows"] });
        setOpen(false);
        setText("");
        toast.success("New show created — tap to review", {
          action: { label: "View", onClick: () => navigate(`/shows/${newShow.id}`) },
        });
      }
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error(err.message || "Failed to parse email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-4 w-4" />
          Paste Advance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste Advance Email</DialogTitle>
          <DialogDescription>
            Paste the full advance email thread below. AI will extract show details automatically.
          </DialogDescription>
        </DialogHeader>
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
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing with AI…
              </>
            ) : (
              "Parse with AI"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
