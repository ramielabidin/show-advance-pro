import { format, parseISO } from "date-fns";
import { Mic } from "lucide-react";
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
                "text-[15px] sm:text-base inline-flex items-baseline gap-1.5 min-w-0 break-words",
                entry.is_band ? "text-foreground font-medium" : "text-foreground",
              )}
            >
              {entry.is_band && (
                <Mic className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0 translate-y-[2px]" />
              )}
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
  // `hasData` types its argument as `Show`; our payload is a subset of Show's
  // non-financial fields — safe to cast for the gating read.
  const has = (k: SectionKey) => hasData(show as unknown as Show, k);
  const city = formatCityState(show.city);
  const rawAddr = show.venue_address?.replace(/,?\s*United States$/i, "") ?? "";
  const showTwoColumn = has("schedule") || has("contact") || has("loadIn") || has("parking");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          Day Sheet
        </p>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl tracking-[-0.02em] break-words">
          {formatDate(show.date)}
        </h1>
        <p className="text-sm sm:text-base text-foreground break-words">
          {show.venue_name}
          {city ? <span className="text-muted-foreground"> · {city}</span> : null}
        </p>
      </header>

      <div className="space-y-6">
        {has("venue") && rawAddr ? (
          <FieldGroup title="Venue">
            <FieldRow label="Address" value={rawAddr} />
          </FieldGroup>
        ) : null}

        {showTwoColumn && (
          <div className="grid grid-cols-1 md:grid-cols-[3fr_auto_2fr] gap-x-6 gap-y-6">
            <div className="min-w-0">
              {has("schedule") && (
                <FieldGroup title="Schedule">
                  <Schedule show={show} />
                </FieldGroup>
              )}
            </div>

            <Separator orientation="vertical" className="hidden md:block h-auto" />

            <div className="space-y-6 min-w-0">
              {has("contact") && (
                <FieldGroup title="Day of Show Contact" contentClassName="space-y-2">
                  <FieldRow label="Name" value={show.dos_contact_name} />
                  <FieldRow label="Phone" value={show.dos_contact_phone} mono />
                </FieldGroup>
              )}

              {has("loadIn") && (
                <FieldGroup title="Load In">
                  <FieldRow label="" value={show.load_in_details} noLabel />
                </FieldGroup>
              )}

              {has("parking") && (
                <FieldGroup title="Parking">
                  <FieldRow label="" value={show.parking_notes} noLabel />
                </FieldGroup>
              )}
            </div>
          </div>
        )}

        {has("departure") && (
          <FieldGroup title="Departure">
            <FieldRow label="Time" value={show.departure_time} mono />
            <FieldRow label="Notes" value={show.departure_notes} />
          </FieldGroup>
        )}

        {has("greenRoom") && (
          <FieldGroup title="Green Room">
            <FieldRow label="" value={show.green_room_info} noLabel />
          </FieldGroup>
        )}

        {show.venue_capacity ? (
          <FieldGroup title="Venue Details">
            <FieldRow label="Capacity" value={show.venue_capacity.toString()} />
          </FieldGroup>
        ) : null}

        <Separator />

        <FieldGroup title="Guest List">
          <GuestGuestList
            token={token}
            initialValue={show.guest_list_details}
            compsAllotment={show.artist_comps}
          />
        </FieldGroup>

        {has("wifi") && (
          <>
            <Separator />
            <FieldGroup title="WiFi">
              <FieldRow label="Network" value={show.wifi_network} mono />
              <FieldRow label="Password" value={show.wifi_password} mono />
            </FieldGroup>
          </>
        )}

        {has("hotel") && (
          <>
            <Separator />
            <FieldGroup title="Accommodations">
              <FieldRow label="Name" value={show.hotel_name} />
              <FieldRow label="Address" value={show.hotel_address} />
              <FieldRow label="Confirmation #" value={show.hotel_confirmation} mono />
              <FieldRow label="Check In" value={show.hotel_checkin} mono />
              <FieldRow label="Check Out" value={show.hotel_checkout} mono />
            </FieldGroup>
          </>
        )}
      </div>
    </div>
  );
}
