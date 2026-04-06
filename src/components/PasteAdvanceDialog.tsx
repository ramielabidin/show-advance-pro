import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
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
import { toast } from "sonner";

interface PasteAdvanceDialogProps {
  onParsed: (data: Record<string, any>) => void;
}

export default function PasteAdvanceDialog({ onParsed }: PasteAdvanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error("Paste an advance email first");
      return;
    }
    setLoading(true);
    try {
      // TODO: Connect to edge function for AI parsing
      toast.info("AI parsing will be connected once the edge function is set up");
      setLoading(false);
    } catch {
      toast.error("Failed to parse email");
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
                Parsing…
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
