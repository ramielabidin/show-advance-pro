import { format, parseISO } from "date-fns";
import { Users } from "lucide-react";
import FieldGroup from "@/components/FieldGroup";
import { formatCityState } from "@/lib/utils";
import { parseGuestList, guestTotal } from "@/components/GuestListEditor";
import type { GuestShowPayload } from "@/lib/guestLinks";

interface DoorListGuestViewProps {
  show: GuestShowPayload;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "EEEE, MMMM d, yyyy");
  } catch {
    return iso;
  }
}

export default function DoorListGuestView({ show }: DoorListGuestViewProps) {
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
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl tracking-[-0.02em] break-words">
          {formatDate(show.date)}
        </h1>
        {subtitle ? (
          <p className="text-sm sm:text-base text-foreground break-words">{subtitle}</p>
        ) : null}
      </header>

      <FieldGroup title="Guest List">
        {(() => {
          const entries = parseGuestList(show.guest_list_details);
          if (entries.length === 0) {
            return <p className="text-sm text-muted-foreground">No guests on the list.</p>;
          }
          const total = guestTotal(entries);
          return (
            <div className="space-y-2">
              <ul className="space-y-1">
                {entries.map((entry, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-foreground break-words">{entry.name}</span>
                    {entry.plusOnes > 0 ? (
                      <span className="text-xs text-muted-foreground">+{entry.plusOnes}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>
                  {total} guest{total !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })()}
      </FieldGroup>
    </div>
  );
}
