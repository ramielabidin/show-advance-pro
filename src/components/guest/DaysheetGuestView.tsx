import { useState } from "react";
import { format, parseISO } from "date-fns";
import { FileText, Loader2, MapPin } from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";
import { Card } from "@/components/ui/card";
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import { cn, formatCityState } from "@/lib/utils";
import { hasData, type SectionKey } from "@/lib/daysheetSections";
import { formatHotelMoment } from "@/lib/timeFormat";
import { roleLabel } from "@/lib/contactRoles";
import { supabase } from "@/integrations/supabase/client";
import type { Show } from "@/lib/types";
import type { GuestAttachment, GuestShowPayload } from "@/lib/guestLinks";
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

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ att, token }: { att: GuestAttachment; token: string }) {
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    // Open tab synchronously — mobile browsers block window.open() after await.
    const win = window.open("", "_blank");
    try {
      const { data, error } = await supabase.functions.invoke("guest-attachment-url", {
        body: { token, attachment_id: att.id },
      });
      if (error || !data?.url) {
        win?.close();
        return;
      }
      if (win) win.location.href = data.url;
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={opening}
      className="flex items-center gap-2.5 w-full text-left group/att"
    >
      {opening ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground group-hover/att:text-foreground transition-colors" />
      )}
      <div className="min-w-0">
        <p className="text-sm text-foreground group-hover/att:underline truncate">
          {att.original_filename}
        </p>
        {att.size_bytes ? (
          <p className="text-xs text-muted-foreground">{formatSize(att.size_bytes)}</p>
        ) : null}
      </div>
    </button>
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

        {has("contact") && (() => {
          const contacts = [...(show.contacts ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          const dos = contacts.find((c) => c.role === "day_of_show");
          const others = contacts.filter((c) => c !== dos);
          return (
            <>
              {dos && (
                <FieldGroup title="Day of Show Contact" contentClassName="space-y-2">
                  <FieldRow label="Name" value={dos.name} />
                  <FieldRow label="Phone" value={dos.phone} mono />
                  <FieldRow label="Email" value={dos.email} mono />
                </FieldGroup>
              )}
              {others.length > 0 && (
                <>
                  <FieldGroup title="Other Contacts" contentClassName="space-y-3">
                    {others.map((c) => (
                      <div key={c.id} className="space-y-1">
                        <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
                          {roleLabel(c)}
                        </div>
                        <FieldRow label="Name" value={c.name} />
                        <FieldRow label="Phone" value={c.phone} mono />
                        <FieldRow label="Email" value={c.email} mono />
                      </div>
                    ))}
                  </FieldGroup>
                </>
              )}
            </>
          );
        })()}

        {has("departure") && (
          <FieldGroup title="Departure" contentClassName="space-y-2">
            <FieldRow label="Time" value={show.departure_time} mono />
            <FieldRow label="Notes" value={show.departure_notes} />
          </FieldGroup>
        )}

        {hasArrival && (
          <FieldGroup title="Arrival" contentClassName="space-y-2">
            {has("loadIn") && <FieldRow label="Load In" value={show.load_in_details} />}
            {has("parking") && <FieldRow label="Parking" value={show.parking_notes} />}
          </FieldGroup>
        )}

        {hasAtVenue && (
          <FieldGroup title="At The Venue" contentClassName="space-y-2">
              {has("greenRoom") && <FieldRow label="Green Room" value={show.green_room_info} />}
              {has("wifi") && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                  <span className="text-sm text-muted-foreground sm:shrink-0 sm:w-32">WiFi</span>
                  <div className="flex flex-col gap-0.5">
                    {show.wifi_network && (
                      <span className="text-sm text-foreground font-mono text-[13px]">{show.wifi_network}</span>
                    )}
                    {show.wifi_password && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-foreground font-mono text-[13px]">{show.wifi_password}</span>
                        <CopyButton value={show.wifi_password} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </FieldGroup>
        )}

        <FieldGroup title="Guest List">
          <GuestGuestList
            token={token}
            initialValue={show.guest_list_details}
            compsAllotment={show.artist_comps}
          />
        </FieldGroup>

        {has("hotel") && (
          <FieldGroup title="Accommodations">
              <div className="rounded-lg border border-dashed border-foreground/20 bg-background/40">
                {(show.hotel_name || show.hotel_address) && (
                  <div className="px-4 sm:px-5 pt-4 pb-3">
                    {show.hotel_name && (
                      <div className="font-display text-xl sm:text-2xl tracking-tight leading-tight text-foreground">
                        {show.hotel_name}
                      </div>
                    )}
                    {show.hotel_address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(show.hotel_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex items-start gap-1 font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground",
                          show.hotel_name && "mt-1.5"
                        )}
                      >
                        <MapPin className="h-3 w-3 shrink-0 mt-[3px]" />
                        <span>{show.hotel_address.replace(/,?\s*United States$/i, "")}</span>
                      </a>
                    )}
                  </div>
                )}
                {(() => {
                  const checkInDisplay = formatHotelMoment(show.hotel_checkin_date, show.hotel_checkin);
                  const checkOutDisplay = formatHotelMoment(show.hotel_checkout_date, show.hotel_checkout);
                  if (!show.hotel_confirmation && !checkInDisplay && !checkOutDisplay) return null;
                  const filled = [show.hotel_confirmation, checkInDisplay, checkOutDisplay].filter(Boolean).length;
                  return (
                    <div
                      className={cn(
                        "px-4 sm:px-5 pb-4 pt-3 grid gap-4 grid-cols-1",
                        (show.hotel_name || show.hotel_address) && "border-t border-dashed border-foreground/15",
                        filled === 3 ? "sm:grid-cols-3" : filled === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1",
                      )}
                    >
                      {show.hotel_confirmation && (
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Confirmation #</div>
                          <div className="font-mono text-[13px] text-foreground mt-1 break-all">{show.hotel_confirmation}</div>
                        </div>
                      )}
                      {checkInDisplay && (
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Check In</div>
                          <div className="font-mono text-[13px] text-foreground mt-1">{checkInDisplay}</div>
                        </div>
                      )}
                      {checkOutDisplay && (
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Check Out</div>
                          <div className="font-mono text-[13px] text-foreground mt-1">{checkOutDisplay}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </FieldGroup>
        )}

        {show.additional_info && (
          <FieldGroup title="Notes">
            <FieldRow label="" value={show.additional_info} noLabel />
          </FieldGroup>
        )}

        {show.attachments?.length > 0 && (
          <FieldGroup title="Attachments" contentClassName="space-y-3">
            {show.attachments.map((att) => (
              <AttachmentRow key={att.id} att={att} token={token} />
            ))}
          </FieldGroup>
        )}
      </div>
    </div>
  );
}
