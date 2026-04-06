import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CreateShowDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!venue || !city || !date) {
      toast.error("Please fill in venue, city, and date");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("shows")
      .insert({ venue_name: venue, city, date, is_reviewed: true })
      .select()
      .single();
    setLoading(false);
    if (error) {
      toast.error("Failed to create show");
      return;
    }
    setOpen(false);
    setVenue("");
    setCity("");
    setDate("");
    toast.success("Show created");
    navigate(`/shows/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Show
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Show</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="The Troubadour" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Los Angeles, CA" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create Show"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
