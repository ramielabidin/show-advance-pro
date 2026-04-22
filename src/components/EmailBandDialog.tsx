import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCityState } from "@/lib/utils";
import type { Show } from "@/lib/types";

const MAX_PERSONAL_MESSAGE_CHARS = 2000;

interface EmailBandDialogProps {
  show: Show & { schedule_entries?: unknown[] };
  trigger?: React.ReactNode;
}

function defaultSubject(show: EmailBandDialogProps["show"]): string {
  let dateStr = "";
  try {
    dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
  } catch {
    dateStr = "";
  }
  const city = formatCityState(show.city);
  const cityPart = city ? ` (${city})` : "";
  const datePart = dateStr ? `${dateStr} - ` : "";
  return `${datePart}${show.venue_name ?? "Show"}${cityPart} - Day Sheet`;
}

function senderDisplayName(
  metadata: Record<string, unknown> | undefined,
  email: string | null | undefined,
): string {
  const meta = metadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  if (email) {
    const local = email.split("@")[0];
    if (local) return local;
  }
  return "Advance";
}

export default function EmailBandDialog({ show, trigger }: EmailBandDialogProps) {
  const { teamId } = useTeam();
  const { session } = useAuth();
  const user = session?.user;

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(() => defaultSubject(show));
  const [personalMessage, setPersonalMessage] = useState("");

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["touring-party", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("touring_party_members")
        .select("name, email")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!teamId,
  });

  const recipients = members.filter((m): m is { name: string | null; email: string } =>
    typeof m.email === "string" && m.email.trim().length > 0,
  );

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-daysheet-email", {
        body: { showId: show.id, subject, personalMessage },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; recipientCount: number };
    },
    onSuccess: (data) => {
      const count = data?.recipientCount ?? recipients.length;
      toast.success(`Day sheet sent to ${count} recipient${count === 1 ? "" : "s"}`);
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send day sheet");
    },
  });

  // Reset local state whenever the dialog closes so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setPersonalMessage("");
      setSubject(defaultSubject(show));
    }
  }, [open, show]);

  const sendDisabled = sendMutation.isPending || recipients.length === 0 || loadingMembers;
  const displayName = senderDisplayName(user?.user_metadata, user?.email);

  const openDialog = () => setOpen(true);

  return (
    <>
      {trigger ? (
        <span
          onClick={(e) => {
            e.preventDefault();
            openDialog();
          }}
        >
          {trigger}
        </span>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={openDialog}>
          <Mail className="h-4 w-4" /> Email Band
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Email Day Sheet</DialogTitle>
            <DialogDescription>
              Sends an HTML day sheet to your touring party. Replies come to you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Recipients
              </Label>
              {loadingMembers ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No touring party members with email addresses. Add someone in Settings → Team
                  before sending.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {recipients.map((m) => (
                    <span
                      key={m.email}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs"
                    >
                      <span className="font-medium">{m.name || m.email}</span>
                      {m.name ? (
                        <span className="text-muted-foreground">&lt;{m.email}&gt;</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-xs uppercase tracking-widest text-muted-foreground">
                Subject
              </Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sendMutation.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="email-message" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Personal note (optional)
                </Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {personalMessage.length}/{MAX_PERSONAL_MESSAGE_CHARS}
                </span>
              </div>
              <Textarea
                id="email-message"
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value.slice(0, MAX_PERSONAL_MESSAGE_CHARS))}
                placeholder="Add a quick note — shown at the top of the email."
                rows={4}
                disabled={sendMutation.isPending}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              From <span className="font-medium text-foreground">{displayName}</span> via Advance ·
              Replies go to {user?.email ?? "you"}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => sendMutation.mutate()} disabled={sendDisabled}>
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" /> Send day sheet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
