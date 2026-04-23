import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePendingEmails } from "@/components/PendingEmailsProvider";

function formatShowDate(iso: string): string {
  // Parse as local-date to avoid the UTC-midnight off-by-one that new Date("YYYY-MM-DD") causes.
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function PendingEmailsModal() {
  const { events, upcomingShows, review, createFromEvent, dismiss } = usePendingEmails();
  const [index, setIndex] = useState(0);
  const [manualShowId, setManualShowId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);

  const current = events[Math.min(index, events.length - 1)];
  const open = !!current;

  // Reset manual selection whenever the visible event changes.
  useEffect(() => {
    setManualShowId(null);
  }, [current?.id]);

  const confidence = current?.match_confidence ?? null;
  const matched = current?.matched_show ?? null;

  const selectedShowId = useMemo(() => {
    if (manualShowId) return manualShowId;
    return matched?.id ?? null;
  }, [manualShowId, matched]);

  if (!current) return null;

  const handleOpenChange = (next: boolean) => {
    if (!next && current) {
      dismiss(current.id);
      setIndex(0);
    }
  };

  const handleReview = async () => {
    if (!current || !selectedShowId) return;
    setSubmitting(true);
    try {
      await review(current.id, selectedShowId);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!current) return;
    setCreating(true);
    try {
      await createFromEvent(current.id);
    } finally {
      setCreating(false);
    }
  };

  const handleDismiss = () => {
    dismiss(current.id);
    setIndex(0);
  };

  const busy = submitting || creating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <DialogTitle>
              {events.length > 1 ? "New advance emails" : "New advance email"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {events.length > 1 ? `${index + 1} of ${events.length} · ` : null}
            Forwarded email received. Review to parse it into a show.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-1 min-w-0">
            <p className="text-sm font-medium text-foreground break-words">
              {current.email_subject || "(no subject)"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              From: {current.from_address || "unknown sender"}
            </p>
          </div>

          <div className="rounded-md border px-3 py-2.5 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Matched show
            </p>

            {matched ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground truncate">
                  {matched.venue_name}
                  {matched.city ? (
                    <span className="text-muted-foreground font-normal"> · {matched.city}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{formatShowDate(matched.date)}</p>
                <ConfidenceRow confidence={confidence} />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No match found</p>
                <Select value={manualShowId ?? undefined} onValueChange={setManualShowId}>
                  <SelectTrigger className="h-11 sm:h-9">
                    <SelectValue placeholder="Link to existing show…" />
                  </SelectTrigger>
                  <SelectContent>
                    {upcomingShows.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No upcoming shows
                      </div>
                    ) : (
                      upcomingShows.map((show) => (
                        <SelectItem key={show.id} value={show.id}>
                          {show.venue_name} · {formatShowDate(show.date)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                <Button
                  variant="outline"
                  className="w-full h-11 sm:h-9 gap-1.5"
                  onClick={handleCreate}
                  disabled={busy}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating show…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create new show from this email
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleDismiss} disabled={busy}>
            Dismiss
          </Button>
          <Button onClick={handleReview} disabled={busy || !selectedShowId}>
            Review Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfidenceRow({ confidence }: { confidence: "high" | "low" | null }) {
  if (confidence === "high") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]"
          aria-hidden="true"
        />
        Confident match.
      </div>
    );
  }
  if (confidence === "low") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]"
          aria-hidden="true"
        />
        Review match.
      </div>
    );
  }
  return null;
}
