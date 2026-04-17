import { useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePendingEmails } from "@/components/PendingEmailsProvider";
import ParseAdvanceForShowDialog from "@/components/ParseAdvanceForShowDialog";

export default function PendingEmailsModal() {
  const { events, reviewState, parsing, review, dismiss, closeReview, onReviewComplete } = usePendingEmails();
  const [index, setIndex] = useState(0);

  const current = events[Math.min(index, events.length - 1)];
  const promptOpen = useMemo(() => !reviewState && !!current, [reviewState, current]);

  if (!current && !reviewState) return null;

  const handlePromptOpenChange = (open: boolean) => {
    if (!open && current) {
      // User closed the prompt modal (X/Esc). Session-suppress this event.
      dismiss(current.id);
      setIndex(0);
    }
  };

  const handleReview = () => {
    if (current) review(current);
  };

  const handleDismiss = () => {
    if (current) {
      dismiss(current.id);
      setIndex(0);
    }
  };

  return (
    <>
      <Dialog open={promptOpen} onOpenChange={handlePromptOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <DialogTitle>
                {events.length > 1 ? "New Advance Emails" : "New Advance Email"}
              </DialogTitle>
            </div>
            <DialogDescription>
              {events.length > 1 ? `${index + 1} of ${events.length} · ` : null}
              Forwarded email received. Review to parse it into a show.
            </DialogDescription>
          </DialogHeader>

          {current && (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-1">
              <p className="text-sm font-medium text-foreground truncate">
                {current.email_subject || "(no subject)"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                From: {current.from_address || "unknown sender"}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleDismiss} disabled={parsing}>
              Dismiss
            </Button>
            <Button onClick={handleReview} disabled={parsing} className="gap-1.5">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {parsing ? "Parsing…" : "Review Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reviewState?.matchedShow && (
        <ParseAdvanceForShowDialog
          showId={reviewState.matchedShow.id}
          currentShow={reviewState.matchedShow}
          initialParsedResult={reviewState.parsed}
          open={true}
          onOpenChange={(open) => {
            if (!open) closeReview();
          }}
          hideTrigger
          onUpdated={() => onReviewComplete(reviewState.matchedShow!.id)}
        />
      )}
    </>
  );
}
