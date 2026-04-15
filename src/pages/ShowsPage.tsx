import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isPast, isToday, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ShowCard from "@/components/ShowCard";
import CreateShowDialog from "@/components/CreateShowDialog";
import PasteAdvanceDialog from "@/components/PasteAdvanceDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import EmptyState from "@/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ShowsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Show deleted");
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-info"] });
    },
    onError: (err: Error) => {
      toast.error("Failed to delete show: " + err.message);
    },
  });

  const { data: shows = [], isLoading } = useQuery({
    queryKey: ["shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: scheduleMap = {} } = useQuery({
    queryKey: ["schedule-info"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule_entries").select("show_id, label");
      if (error) throw error;
      const map: Record<string, { hasSchedule: boolean; hasLoadIn: boolean }> = {};
      data.forEach((e) => {
        if (!map[e.show_id]) map[e.show_id] = { hasSchedule: false, hasLoadIn: false };
        map[e.show_id].hasSchedule = true;
        if (e.label.toLowerCase().includes("load")) map[e.show_id].hasLoadIn = true;
      });
      return map;
    },
  });

  const upcoming = shows.filter(
    (s) => !isPast(parseISO(s.date)) || isToday(parseISO(s.date))
  );
  const past = shows
    .filter((s) => isPast(parseISO(s.date)) && !isToday(parseISO(s.date)))
    .reverse();

  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="animate-fade-in">
      <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight">Shows</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <BulkUploadDialog />
            <PasteAdvanceDialog />
          </div>
          <CreateShowDialog />
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={tab === "upcoming" ? "No upcoming shows" : "No past shows"}
          description={
            tab === "upcoming"
              ? "Add a show manually or paste an advance email to get started."
              : "Past shows will appear here after their date passes."
          }
          action={tab === "upcoming" ? <CreateShowDialog /> : undefined}
        />
      ) : (
        <div className="space-y-2 stagger-list">
          {displayed.map((show) => (
            <ShowCard
              key={show.id}
              show={show}
              hasLoadIn={!!scheduleMap[show.id]?.hasLoadIn}
              hasDosContact={!!show.dos_contact_name}
              onDelete={() => setPendingDeleteId(show.id)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the show and all associated schedule entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
