import { format, parseISO } from "date-fns";
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import { Separator } from "@/components/ui/separator";
import { hasData, type SectionKey } from "@/lib/daysheetSections";
import { formatCityState } from "@/lib/utils";
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
    <div className="space-y-1.5">
      {entries.map((e) => {
        const setInline = e.is_band && show.set_length ? ` (${show.set_length})` : "";
        const isBand = !!e.is_band;
        return (
          <div
            key={e.id}
            className="grid grid-cols-[88px_1fr] gap-3 text-sm items-baseline"
          >
            <span className="font-mono text-muted-foreground">{e.time ?? ""}</span>
            <span className={isBand ? "text-foreground font-medium" : "text-foreground"}>
              {e.label}
              {setInline}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DaysheetGuestView({ show, token }: DaysheetGuestViewProps) {
  // `hasData` types its argument as `Show`; our payload is a subset of Show's
  // non-financial fields — safe to cast for the gating read.
  const has = (k: SectionKey) => hasData(show as unknown as Show, k);
  const city = formatCityState(show.city);
  const rawAddr = show.venue_address?.replace(/,?\s*United States$/i, "") ?? "";

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          Day Sheet
        </p>
        <h1 className="font-display text-3xl sm:text-4xl tracking-[-0.02em]">
          {formatDate(show.date)}
        </h1>
        <p className="text-base text-foreground">
          {show.venue_name}
          {city ? <span className="text-muted-foreground"> · {city}</span> : null}
        </p>
      </header>

      <div className="space-y-6">
        {has("contact") && (
          <FieldGroup title="Day of Show Contact">
            <FieldRow label="Name" value={show.dos_contact_name} />
            <FieldRow label="Phone" value={show.dos_contact_phone} mono />
          </FieldGroup>
        )}

        {has("venue") && (
          <FieldGroup title="Venue">
            {rawAddr ? <FieldRow label="Address" value={rawAddr} /> : null}
          </FieldGroup>
        )}

        {has("schedule") && (
          <FieldGroup title="Schedule">
            <Schedule show={show} />
          </FieldGroup>
        )}

        {has("departure") && (
          <FieldGroup title="Departure">
            <FieldRow label="Time" value={show.departure_time} mono />
            <FieldRow label="Notes" value={show.departure_notes} />
          </FieldGroup>
        )}

        {has("parking") && (
          <FieldGroup title="Parking">
            <FieldRow label="" value={show.parking_notes} noLabel />
          </FieldGroup>
        )}

        {has("loadIn") && (
          <FieldGroup title="Load In">
            <FieldRow label="" value={show.load_in_details} noLabel />
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
