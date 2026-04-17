import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { extractTextFromPdf } from "@/lib/pdfExtract";
import { saveParsedShow, type ParsedShow } from "@/lib/saveParsedShow";
import { toast } from "sonner";
import type { Show } from "@/lib/types";
import PendingEmailsModal from "@/components/PendingEmailsModal";

const STORAGE_BUCKET = "inbound-attachments";

export interface PendingInboundEvent {
  id: string;
  team_id: string;
  email_subject: string | null;
  from_address: string | null;
  raw_email_text: string;
  created_at: string;
}

export interface PendingInboundAttachment {
  id: string;
  event_id: string;
  storage_path: string;
  original_filename: string;
  content_type: string | null;
  size_bytes: number | null;
}

export interface ReviewState {
  event: PendingInboundEvent;
  parsed: Record<string, unknown>;
  matchedShow: Show | null;
}

interface PendingEmailsContextType {
  events: PendingInboundEvent[];
  loading: boolean;
  dismissed: Set<string>;
  reviewState: ReviewState | null;
  parsing: boolean;
  review: (event: PendingInboundEvent) => Promise<void>;
  dismiss: (eventId: string) => Promise<void>;
  closeReview: () => void;
  onReviewComplete: (showId: string) => Promise<void>;
}

const PendingEmailsContext = createContext<PendingEmailsContextType | null>(null);

export function usePendingEmails() {
  const ctx = useContext(PendingEmailsContext);
  if (!ctx) throw new Error("usePendingEmails must be used within PendingEmailsProvider");
  return ctx;
}

async function downloadAndExtractAttachments(attachments: PendingInboundAttachment[]): Promise<string> {
  if (attachments.length === 0) return "";
  const chunks: string[] = [];
  for (const att of attachments) {
    if (att.content_type !== "application/pdf") continue;
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(att.storage_path);
      if (error || !data) {
        console.error("attachment download failed", att.storage_path, error?.message);
        continue;
      }
      const file = new File([data], att.original_filename, { type: "application/pdf" });
      const text = await extractTextFromPdf(file);
      if (text.trim()) {
        chunks.push(`\n\n--- Attachment: ${att.original_filename} ---\n\n${text}`);
      }
    } catch (e) {
      console.error("attachment extract failed", att.storage_path, e instanceof Error ? e.message : "unknown");
    }
  }
  return chunks.join("");
}

export function PendingEmailsProvider({ children }: { children: ReactNode }) {
  const { teamId } = useTeam();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [parsing, setParsing] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["inbound-events-pending", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_parse_events")
        .select("id, team_id, email_subject, from_address, raw_email_text, created_at")
        .eq("team_id", teamId!)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PendingInboundEvent[];
    },
    enabled: !!teamId,
    refetchOnWindowFocus: false,
  });

  const visibleEvents = useMemo(
    () => events.filter((e) => !dismissed.has(e.id)),
    [events, dismissed],
  );

  const review = useCallback(async (event: PendingInboundEvent) => {
    if (!teamId) return;
    setParsing(true);
    try {
      const { data: attachments } = await supabase
        .from("inbound_email_attachments")
        .select("id, event_id, storage_path, original_filename, content_type, size_bytes")
        .eq("event_id", event.id);

      const attachmentText = await downloadAndExtractAttachments(
        (attachments ?? []) as PendingInboundAttachment[],
      );
      const combined = (event.raw_email_text || "") + attachmentText;
      if (!combined.trim()) {
        toast.error("Nothing to parse in this email");
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "parse-advance",
        { body: { emailText: combined } },
      );
      if (fnError) throw new Error(fnError.message || "Failed to parse");
      if (fnData?.error) throw new Error(fnData.error);
      const parsed = fnData.show as Record<string, unknown> | undefined;
      if (!parsed?.venue_name || !parsed?.city || !parsed?.date) {
        throw new Error("AI could not extract required fields (venue, city, date)");
      }

      const { data: matches } = await supabase
        .from("shows")
        .select("*, schedule_entries(*)")
        .eq("team_id", teamId)
        .eq("venue_name", parsed.venue_name)
        .eq("date", parsed.date)
        .limit(1);

      if (matches && matches.length > 0) {
        setReviewState({ event, parsed, matchedShow: matches[0] as Show });
      } else {
        const { showId } = await saveParsedShow(parsed as ParsedShow, teamId);
        await finalizeReview(event.id, showId);
        toast.success("New show created from inbound email", {
          action: { label: "View", onClick: () => navigate(`/shows/${showId}`) },
        });
      }
    } catch (err: unknown) {
      console.error("inbound review parse error", err);
      toast.error(err instanceof Error ? err.message : "Failed to parse inbound email");
    } finally {
      setParsing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, navigate]);

  const finalizeReview = useCallback(async (eventId: string, showId: string) => {
    const nowIso = new Date().toISOString();
    await supabase
      .from("inbound_parse_events")
      .update({ status: "reviewed", reviewed_at: nowIso, reviewed_show_id: showId })
      .eq("id", eventId);
    await supabase
      .from("inbound_email_attachments")
      .update({ show_id: showId })
      .eq("event_id", eventId);
    queryClient.invalidateQueries({ queryKey: ["inbound-events-pending", teamId] });
    queryClient.invalidateQueries({ queryKey: ["inbound-events-recent", teamId] });
    queryClient.invalidateQueries({ queryKey: ["inbound-attachments", showId] });
    queryClient.invalidateQueries({ queryKey: ["shows"] });
    queryClient.invalidateQueries({ queryKey: ["show", showId] });
  }, [queryClient, teamId]);

  const onReviewComplete = useCallback(async (showId: string) => {
    if (!reviewState) return;
    await finalizeReview(reviewState.event.id, showId);
    setReviewState(null);
  }, [finalizeReview, reviewState]);

  const dismiss = useCallback(async (eventId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });
    const { error } = await supabase
      .from("inbound_parse_events")
      .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) {
      toast.error("Failed to dismiss");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["inbound-events-pending", teamId] });
    queryClient.invalidateQueries({ queryKey: ["inbound-events-recent", teamId] });
  }, [queryClient, teamId]);

  const closeReview = useCallback(() => {
    if (reviewState) {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(reviewState.event.id);
        return next;
      });
    }
    setReviewState(null);
  }, [reviewState]);

  const contextValue: PendingEmailsContextType = {
    events: visibleEvents,
    loading: isLoading,
    dismissed,
    reviewState,
    parsing,
    review,
    dismiss,
    closeReview,
    onReviewComplete,
  };

  return (
    <PendingEmailsContext.Provider value={contextValue}>
      {children}
      <PendingEmailsModal />
    </PendingEmailsContext.Provider>
  );
}
