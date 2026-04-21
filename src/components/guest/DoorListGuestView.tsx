import { format, parseISO } from "date-fns";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import FieldGroup from "@/components/FieldGroup";
import { cn, formatCityState } from "@/lib/utils";
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

  let artistVenue = "";
  if (show.artist_name && show.venue_name) {
    artistVenue = `${show.artist_name} at ${show.venue_name}`;
  } else if (show.venue_name) {
    artistVenue = show.venue_name;
  } else if (show.artist_name) {
    artistVenue = show.artist_name;
  }
  const dateCity = [formatDate(show.date), city].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        {artistVenue ? (
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl tracking-[-0.02em] break-words">
            {artistVenue}
          </h1>
        ) : null}
        {dateCity ? (
          <p className="text-sm sm:text-base text-muted-foreground break-words">{dateCity}</p>
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
            <div className="space-y-3">
              <Card className="p-3 sm:p-4">
                {entries.map((entry, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-[1fr_auto] gap-3 items-baseline py-3 sm:py-3.5 px-1",
                      i < entries.length - 1 && "border-b border-border/60",
                    )}
                  >
                    <span className="font-display text-xl sm:text-2xl tracking-[-0.01em] leading-tight text-foreground break-words">
                      {entry.name}
                    </span>
                    {entry.plusOnes > 0 ? (
                      <span className="font-mono text-xs sm:text-sm text-muted-foreground shrink-0">
                        +{entry.plusOnes}
                      </span>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </Card>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
