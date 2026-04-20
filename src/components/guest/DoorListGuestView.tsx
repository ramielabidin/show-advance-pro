import { format, parseISO } from "date-fns";
import FieldGroup from "@/components/FieldGroup";
import { formatCityState } from "@/lib/utils";
import type { GuestShowPayload } from "@/lib/guestLinks";
import GuestGuestList from "./GuestGuestList";

interface DoorListGuestViewProps {
  show: GuestShowPayload;
  token: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "EEEE, MMMM d, yyyy");
  } catch {
    return iso;
  }
}

export default function DoorListGuestView({ show, token }: DoorListGuestViewProps) {
  const city = formatCityState(show.city);
  const subtitleParts: string[] = [];
  if (show.artist_name && show.venue_name) {
    subtitleParts.push(`${show.artist_name} at ${show.venue_name}`);
  } else if (show.venue_name) {
    subtitleParts.push(show.venue_name);
  } else if (show.artist_name) {
    subtitleParts.push(show.artist_name);
  }
  if (city) subtitleParts.push(city);
  const subtitle = subtitleParts.join(" · ");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          Door List
        </p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-[-0.02em]">
          {formatDate(show.date)}
        </h1>
        {subtitle ? <p className="text-base text-foreground">{subtitle}</p> : null}
      </header>

      <FieldGroup title="Guest List">
        <GuestGuestList
          token={token}
          initialValue={show.guest_list_details}
          compsAllotment={show.artist_comps}
        />
      </FieldGroup>
    </div>
  );
}
