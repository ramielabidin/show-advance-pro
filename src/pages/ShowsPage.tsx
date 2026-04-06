import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isPast, isToday, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ShowCard from "@/components/ShowCard";
import CreateShowDialog from "@/components/CreateShowDialog";
import PasteAdvanceDialog from "@/components/PasteAdvanceDialog";
import EmptyState from "@/components/EmptyState";

export default function ShowsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

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

  const upcoming = shows.filter(
    (s) => !isPast(parseISO(s.date)) || isToday(parseISO(s.date))
  );
  const past = shows
    .filter((s) => isPast(parseISO(s.date)) && !isToday(parseISO(s.date)))
    .reverse();

  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl tracking-tight">Shows</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PasteAdvanceDialog onParsed={() => {}} />
          <CreateShowDialog />
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
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
        <div className="space-y-2">
          {displayed.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      )}
    </div>
  );
}
