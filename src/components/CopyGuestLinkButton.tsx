import { Link as LinkIcon, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useGuestLink } from "@/hooks/useGuestLink";
import { type GuestLinkType } from "@/lib/guestLinks";

interface CopyGuestLinkButtonProps {
  showId: string;
  linkType: GuestLinkType;
  label?: string;
  /** Standalone rendering: a small ghost button. Used next to the guest list section. */
  className?: string;
}

export default function CopyGuestLinkButton({
  showId,
  linkType,
  label,
  className,
}: CopyGuestLinkButtonProps) {
  const { activeLink, copyOrCreate, regenerate, isPending } = useGuestLink(showId, linkType);

  const defaultLabel = linkType === "daysheet" ? "Copy Day Sheet Link" : "Copy Door List Link";

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        disabled={isPending}
        onClick={() => void copyOrCreate()}
      >
        <LinkIcon className="h-3 w-3" />
        {label ?? defaultLabel}
      </Button>
      {activeLink ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          disabled={isPending}
          onClick={() => void regenerate()}
          title="Revoke the current link and create a new one"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
      ) : null}
    </div>
  );
}

interface GuestLinkMenuItemsProps {
  showId: string;
  linkType: GuestLinkType;
  copyLabel: string;
  regenerateLabel: string;
}

/**
 * Renders one or two `DropdownMenuItem`s for a guest link — "Copy" always,
 * plus "Regenerate" when an active link exists. Drops into the show detail
 * Share dropdown alongside the other share options.
 */
export function GuestLinkMenuItems({
  showId,
  linkType,
  copyLabel,
  regenerateLabel,
}: GuestLinkMenuItemsProps) {
  const { activeLink, copyOrCreate, regenerate, isPending } = useGuestLink(showId, linkType);

  return (
    <>
      <DropdownMenuItem
        disabled={isPending}
        onSelect={(e) => {
          e.preventDefault();
          void copyOrCreate();
        }}
      >
        {copyLabel}
      </DropdownMenuItem>
      {activeLink ? (
        <DropdownMenuItem
          disabled={isPending}
          onSelect={(e) => {
            e.preventDefault();
            void regenerate();
          }}
        >
          {regenerateLabel}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

/**
 * Round icon-button for copying the show's guest day-sheet ("magic") link.
 * Sits alongside the Share button on the show detail header.
 */
export function CopyMagicLinkButton({ showId }: { showId: string }) {
  const { copyOrCreate, isPending } = useGuestLink(showId, "daysheet");
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
      disabled={isPending}
      onClick={() => void copyOrCreate()}
      title="Copy Magic Link"
      aria-label="Copy Magic Link"
    >
      <Sparkles className="h-4 w-4" />
    </Button>
  );
}

/**
 * Dropdown menu item that regenerates the day-sheet magic link. Only renders
 * when an active link already exists — otherwise the primary copy action
 * creates a fresh one, so regenerate would be a no-op.
 */
export function RegenerateMagicLinkMenuItem({ showId }: { showId: string }) {
  const { activeLink, regenerate, isPending } = useGuestLink(showId, "daysheet");
  if (!activeLink) return null;
  return (
    <DropdownMenuItem
      disabled={isPending}
      onSelect={(e) => {
        e.preventDefault();
        void regenerate();
      }}
    >
      Regenerate Magic Link
    </DropdownMenuItem>
  );
}
