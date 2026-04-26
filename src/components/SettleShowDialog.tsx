import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Show } from "@/lib/types";

interface SettleShowDialogProps {
  show: Show;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback fired after a successful settle, in addition to the
   *  internal cache invalidations. Used by Day of Show Mode to react to the
   *  show flipping to settled (which auto-advances to Phase 3). */
  onSettled?: () => void;
}

/**
 * Settle Show modal — captures actual tickets sold, final walkout, and
 * settlement notes, then flips `is_settled = true` on the row.
 *
 * Lifted out of ShowDetailPage so Day of Show Mode (Phase 2) can mount the
 * exact same surface from its "Settle this show" CTA — same form, same
 * mutation, same invalidations. No behavior change.
 */
export default function SettleShowDialog({ show, open, onOpenChange, onSettled }: SettleShowDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    actual_tickets_sold: "",
    actual_walkout: "",
    settlement_notes: "",
  });

  // Reset the form when the dialog closes so a re-open always starts clean.
  // Mirrors the pattern used by other action dialogs in the codebase.
  useEffect(() => {
    if (!open) {
      setForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
    }
  }, [open]);

  const settleMutation = useMutation({
    mutationFn: async (values: { actual_tickets_sold: string; actual_walkout: string; settlement_notes: string }) => {
      const { error } = await supabase
        .from("shows")
        .update({
          is_settled: true,
          actual_tickets_sold: values.actual_tickets_sold || null,
          actual_walkout: values.actual_walkout || null,
          settlement_notes: values.settlement_notes || null,
        })
        .eq("id", show.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", show.id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      onOpenChange(false);
      onSettled?.();
      toast.success("Show settled");
    },
    onError: () => toast.error("Failed to settle show"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settle Show</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="actual_tickets_sold">Actual Tickets Sold</Label>
            <Input
              id="actual_tickets_sold"
              value={form.actual_tickets_sold}
              onChange={(e) => setForm((p) => ({ ...p, actual_tickets_sold: e.target.value }))}
              placeholder={show.venue_capacity ? `Capacity: ${show.venue_capacity}` : "e.g. 450"}
              className="h-11 sm:h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual_walkout">Final Walkout Amount</Label>
            <Input
              id="actual_walkout"
              value={form.actual_walkout}
              onChange={(e) => setForm((p) => ({ ...p, actual_walkout: e.target.value }))}
              placeholder={show.walkout_potential ? `Projected: ${show.walkout_potential}` : "e.g. $4,200"}
              className="h-11 sm:h-9 font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settlement_notes">Notes</Label>
            <Textarea
              id="settlement_notes"
              value={form.settlement_notes}
              onChange={(e) => setForm((p) => ({ ...p, settlement_notes: e.target.value }))}
              placeholder="Any notes about the settlement…"
              className="min-h-[80px]"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1 h-11 sm:h-9" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 sm:h-9 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-[hsl(var(--success-foreground))]"
              onClick={() => settleMutation.mutate(form)}
              disabled={settleMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {settleMutation.isPending ? "Settling…" : "Settle Show"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
