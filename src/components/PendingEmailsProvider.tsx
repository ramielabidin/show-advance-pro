import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { toast } from "sonner";
import PendingEmailsModal from "@/components/PendingEmailsModal";
import { saveParsedShow, type ParsedShow } from "@/lib/saveParsedShow";

export type MatchConfidence = "high" | "low" | null;

export interface MatchedShow {
  id: string;
  venue_name: string;
  date: string;
  city: string | null;
}

export interface PendingInboundEvent {
  id: string;
  team_id: string;
  email_subject: string | null;
  from_address: string | null;
  raw_email_text: string;
  created_at: string;
  matched_show_id: string | null;
  match_confidence: MatchConfidence;
  matched_show: MatchedShow | null;
}

export interface UpcomingShow {
  id: string;
  venue_name: string;
  date: string;
  city: string | null;
}

interface PendingEmailsContextType {
  events: PendingInboundEvent[];
  loading: boolean;
  upcomingShows: UpcomingShow[];
  review: (eventId: string, showId: string) => Promise<void>;
  createFromEvent: (eventId: string) => Promise<void>;
  dismiss: (eventId: string) => Promise<void>;
}

const PendingEmailsContext = createContext<PendingEmailsContextType | null>(null);

export function usePendingEmails() {
  const ctx = useContext(PendingEmailsContext);
  if (!ctx) throw new Error("usePendingEmails must be used within PendingEmailsProvider");
  return ctx;
}

export function PendingEmailsProvider({ children }: { children: ReactNode }) {
  const { teamId, isArtist } = useTeam();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["inbound-events-pending", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_parse_events")
        .select(
          "id, team_id, email_subject, from_address, raw_email_text, created_at, matched_show_id, match_confidence, matched_show:matched_show_id(id, venue_name, date, city)",
        )
        .eq("team_id", teamId!)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        match_confidence: (row.match_confidence as MatchConfidence) ?? null,
      })) as PendingInboundEvent[];
    },
    // Inbound advance review is admin-only — forwarded promoter emails surface
    // financial fields (guarantee, backend deal, walkout). Skip the query
    // entirely for artists so the modal never has anything to show.
    enabled: !!teamId && !isArtist,
    refetchOnWindowFocus: false,
  });

  const visibleEvents = useMemo(
    () => events.filter((e) => !dismissed.has(e.id)),
    [events, dismissed],
  );

  const hasEventsNeedingManualPick = useMemo(
    () => visibleEvents.some((e) => !e.matched_show_id),
    [visibleEvents],
  );

  // Lazily fetch the upcoming shows list only when at least one pending event
  // needs a manual pick — a team with thousands of shows shouldn't pay for
  // this query on every session.
  const { data: upcomingShows = [] } = useQuery({
    queryKey: ["pending-email-upcoming-shows", teamId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("shows")
        .select("id, venue_name, date, city")
        .eq("team_id", teamId!)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as UpcomingShow[];
    },
    enabled: !!teamId && hasEventsNeedingManualPick,
    refetchOnWindowFocus: false,
  });

  const review = useCallback(
    async (eventId: string, showId: string) => {
      const event = events.find((e) => e.id === eventId);
      const nowIso = new Date().toISOString();
      const { error: evErr } = await supabase
        .from("inbound_parse_events")
        .update({ status: "reviewed", reviewed_at: nowIso, reviewed_show_id: showId })
        .eq("id", eventId);
      if (evErr) {
        toast.error("Failed to open show");
        return;
      }
      // Attach any PDFs captured on the inbound event to the chosen show so
      // they show up in the detail page's attachments panel.
      await supabase
        .from("inbound_email_attachments")
        .update({ show_id: showId })
        .eq("event_id", eventId);

      queryClient.invalidateQueries({ queryKey: ["inbound-events-pending", teamId] });
      queryClient.invalidateQueries({ queryKey: ["inbound-events-recent", teamId] });
      queryClient.invalidateQueries({ queryKey: ["inbound-attachments", showId] });

      // Hand the raw email text off to ShowDetailPage via location state so it
      // can auto-open the Import Advance dialog and trigger the AI parse. The
      // state is consumed once (cleared via replaceState) so refreshes and
      // back-nav don't re-trigger the parse.
      navigate(`/shows/${showId}`, {
        state: event?.raw_email_text ? { inboundEmailText: event.raw_email_text } : undefined,
      });
    },
    [events, navigate, queryClient, teamId],
  );

  const createFromEvent = useCallback(
    async (eventId: string) => {
      if (!teamId) return;
      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "parse-advance",
        { body: { emailText: event.raw_email_text } },
      );
      if (fnError) {
        toast.error(fnError.message || "Failed to parse email");
        return;
      }
      if (fnData?.error) {
        toast.error(fnData.error);
        return;
      }
      const parsed = fnData?.show as ParsedShow | undefined;
      if (!parsed?.venue_name || !parsed?.city || !parsed?.date) {
        toast.error("AI could not extract required fields (venue, city, date)");
        return;
      }

      let showId: string;
      let isNew: boolean;
      try {
        ({ showId, isNew } = await saveParsedShow(parsed, teamId));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create show");
        return;
      }

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
      if (!isNew) queryClient.invalidateQueries({ queryKey: ["show", showId] });

      toast.success(isNew ? "New show created from email" : "Existing show updated from email");
      navigate(`/shows/${showId}`);
    },
    [events, navigate, queryClient, teamId],
  );

  const dismiss = useCallback(
    async (eventId: string) => {
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
    },
    [queryClient, teamId],
  );

  const contextValue: PendingEmailsContextType = {
    events: visibleEvents,
    loading: isLoading,
    upcomingShows,
    review,
    createFromEvent,
    dismiss,
  };

  return (
    <PendingEmailsContext.Provider value={contextValue}>
      {children}
      {!isArtist && <PendingEmailsModal />}
    </PendingEmailsContext.Provider>
  );
}
