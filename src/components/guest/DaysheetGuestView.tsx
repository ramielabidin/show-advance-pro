import { format, parseISO } from "date-fns";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import { cn, formatCityState } from "@/lib/utils";
import { hasData, type SectionKey } from "@/lib/daysheetSections";
import type { Show } from "@/lib/types";
import type { GuestShowPayload } from "@/lib/guestLinks";
import GuestGuestList from "./GuestGuestList";

interface DaysheetGuestViewProps {
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

function Schedule({ show }: { show: GuestShowPayload }) {
  const entries = [...(show.schedule_entries ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  if (entries.length === 0) return null;
  return (
    <Card className="p-3 sm:p-4">
      {entries.map((entry, i) => {
        const setInline = entry.is_band && show.set_length ? ` (${show.set_length})` : "";
        return (
          <div
            key={entry.id}
            className={cn(
              "grid grid-cols-[68px_1fr] sm:grid-cols-[80px_1fr] gap-2.5 sm:gap-3 items-baseline py-2 sm:py-2.5 px-1",
              i < entries.length - 1 && "border-b border-border/60",
            )}
          >
            <span className="font-mono text-xs sm:text-sm shrink-0 whitespace-nowrap text-muted-foreground pt-0.5">
              {entry.time ?? ""}
            </span>
            <span
              className={cn(
                "text-[15px] sm:text-base min-w-0 break-words",
                entry.is_band
                  ? "font-semibold text-[var(--pastel-green-fg)]"
                  : "text-foreground",
              )}
            >
              <span className="min-w-0 break-words">
                {entry.label}
                {setInline}
              </span>
            </span>
          </div>
        );
      })}
    </Card>
  );
}

export default function DaysheetGuestView({ show, token }: DaysheetGuestViewProps) {
  const has = (k: SectionKey) => hasData(show as unknown as Show, k);
  const city = formatCityState(show.city);
  const rawAddr = show.venue_address?.replace(/,?\s*United States$/i, "") ?? "";

  const hasArrival = has("loadIn") || has("parking");
  const hasAtVenue = has("greenRoom") || has("wifi");

  let artistVenue = "";
  if (show.artist_name && show.venue_name) {
    artistVenue = `${show.artist_name} at ${show.venue_name}`;
  } else if (show.venue_name) {
    artistVenue = show.venue_name;
  } else if (show.artist_name) {
    artistVenue = show.artist_name;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        {artistVenue ? (
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-[1.05] break-words">
            {artistVenue}
          </h1>
        ) : null}
        <p className="text-sm sm:text-base text-muted-foreground">{formatDate(show.date)}</p>
        {rawAddr ? (
          <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(rawAddr)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline hover:text-foreground transition-colors break-words"
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="break-words">{rawAddr}</span>
            </a>
          </div>
        ) : city ? (
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{city}</span>
          </div>
        ) : null}
      </header>

      <div className="space-y-6">
        {has("schedule") && (
          <FieldGroup title="Schedule">
            <Schedule show={show} />
          </FieldGroup>
        )}

        {has("contact") && (
          <>
            {has("schedule") && <Separator />}
            <FieldGroup title="Day of Show Contact" contentClassName="space-y-2">
              <FieldRow label="Name" value={show.dos_contact_name} />
              <FieldRow label="Phone" value={show.dos_contact_phone} mono />
            </FieldGroup>
          </>
        )}

        {has("departure") && (
          <>
            <Separator />
            <FieldGroup title="Departure" contentClassName="space-y-2">
              <FieldRow label="Time" value={show.departure_time} mono />
              <FieldRow label="Notes" value={show.departure_notes} />
            </FieldGroup>
          </>
        )}

        {hasArrival && (
          <>
            <Separator />
            <FieldGroup title="Arrival" contentClassName="space-y-2">
              {has("loadIn") && <FieldRow label="Load In" value={show.load_in_details} />}
              {has("parking") && <FieldRow label="Parking" value={show.parking_notes} />}
            </FieldGroup>
          </>
        )}

        {hasAtVenue && (
          <>
            <Separator />
            <FieldGroup title="At The Venue" contentClassName="space-y-2">
              {has("greenRoom") && <FieldRow label="Green Room" value={show.green_room_info} />}
              {has("wifi") && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                  <span className="text-sm text-muted-foreground sm:shrink-0 sm:w-32">WiFi</span>
                  <span className="text-sm text-foreground font-mono text-[13px]">
                    {show.wifi_network || "—"}
                    <span className="text-muted-foreground/60 px-1">/</span>
                    {show.wifi_password || "—"}
                  </span>
                </div>
              )}
            </FieldGroup>
          </>
        )}

        {has("hotel") && (
          <>
            <Separator />
            <FieldGroup title="Accommodations" contentClassName="space-y-2">
              <FieldRow label="Name" value={show.hotel_name} />
              <FieldRow label="Address" value={show.hotel_address} />
              <FieldRow label="Confirmation #" value={show.hotel_confirmation} mono />
              <FieldRow label="Check In" value={show.hotel_checkin} mono />
              <FieldRow label="Check Out" value={show.hotel_checkout} mono />
            </FieldGroup>
          </>
        )}

        <Separator />

        <FieldGroup title="Guest List">
          <GuestGuestList
            token={token}
            initialValue={show.guest_list_details}
            compsAllotment={show.artist_comps}
          />
        </FieldGroup>

        {show.additional_info && (
          <>
            <Separator />
            <FieldGroup title="Notes">
              <FieldRow label="" value={show.additional_info} noLabel />
            </FieldGroup>
          </>
        )}
      </div>
    </div>
  );
}
