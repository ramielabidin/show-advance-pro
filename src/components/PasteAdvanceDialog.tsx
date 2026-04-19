import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTeam } from "@/components/TeamProvider";
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
import { extractTextFromPdf } from "@/lib/pdfExtract";

export default function PasteAdvanceDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { teamId } = useTeam();

  const reset = () => {
    setText("");
    setPdfFile(null);
    setExtractingPdf(false);
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

      if (fnError) {
        throw new Error(fnError.message || "Failed to parse");
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
        const showId = existingShows[0].id;
        const { error: updateError } = await supabase
          .from("shows")
          .update({ ...parsed, is_reviewed: false, advance_imported_at: new Date().toISOString() })
          .eq("id", showId);

        if (updateError) throw updateError;

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
        reset();
        toast.success("Existing show updated — tap to review", {
          action: { label: "View", onClick: () => navigate(`/shows/${showId}`) },
        });
      } else {
        const { data: newShow, error: insertError } = await supabase
          .from("shows")
          .insert({ ...parsed, is_reviewed: false, team_id: teamId, advance_imported_at: new Date().toISOString() })
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
        reset();
        toast.success("New show created — tap to review", {
          action: { label: "View", onClick: () => navigate(`/shows/${newShow.id}`) },
        });
      }
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error(err.message || "Failed to parse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
         <FileText className="h-4 w-4" />
          Paste Advance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste Advance</DialogTitle>
          <DialogDescription>
            Paste an advance email, venue tech packet, or any text with show info. You can also upload a PDF.
          </DialogDescription>
        </DialogHeader>
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
