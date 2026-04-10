import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FolderOpen, Plus, ChevronRight, Calendar, MapPin, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCityState } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/EmptyState";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import { toast } from "sonner";

export default function ToursPage() {
  const queryClient = useQueryClient();
  const { teamId } = useTeam();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ["tours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tours")
        .select("*, shows(id, venue_name, city, date)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name) throw new Error("Name required");
      const { error } = await supabase.from("tours").insert({
        name,
        start_date: startDate || null,
        end_date: endDate || null,
        team_id: teamId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      setDialogOpen(false);
      setName("");
      setStartDate("");
      setEndDate("");
      toast.success("Tour created");
    },
    onError: () => toast.error("Failed to create tour"),
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight">Tours</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tours.length} tour{tours.length !== 1 ? "s" : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Tour</span>
              <span className="sm:hidden">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tour
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import from CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Tour</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall 2026 East Coast Run" className="h-11 sm:h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 sm:h-9" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 sm:h-9" />
                </div>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} className="w-full h-11 sm:h-9">
                {createMutation.isPending ? "Creating…" : "Create Tour"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <BulkUploadDialog externalOpen={csvOpen} onExternalOpenChange={setCsvOpen} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : tours.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No tours yet"
          description="Create a tour to group a run of shows together. Shows can also exist standalone."
        />
      ) : (
        <div className="space-y-2">
          {tours.map((tour) => {
            const shows = (tour.shows as any[]) ?? [];
            const sortedShows = [...shows].sort((a, b) => a.date.localeCompare(b.date));
            const dateRange =
              tour.start_date && tour.end_date
                ? `${format(parseISO(tour.start_date), "MMM d")} – ${format(parseISO(tour.end_date), "MMM d, yyyy")}`
                : tour.start_date
                ? `Starting ${format(parseISO(tour.start_date), "MMM d, yyyy")}`
                : null;

            return (
              <Link
                key={tour.id}
                to={`/tours/${tour.id}`}
                className="group flex items-center justify-between rounded-lg border bg-card p-4 sm:p-5 transition-all hover:border-foreground/20 hover:shadow-sm animate-fade-in active:bg-accent/50"
              >
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground text-sm sm:text-base">{tour.name}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                    {dateRange && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {dateRange}
                      </span>
                    )}
                    <span>{shows.length} show{shows.length !== 1 ? "s" : ""}</span>
                  </div>
                  {sortedShows.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {sortedShows.slice(0, 4).map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          {formatCityState(s.city)}
                        </span>
                      ))}
                      {sortedShows.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{sortedShows.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 hidden sm:block" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
