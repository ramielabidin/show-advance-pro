import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuestLink } from "@/hooks/useGuestLink";
import { type GuestLinkType } from "@/lib/guestLinks";

interface CopyGuestLinkButtonProps {
  showId: string;
  linkType: GuestLinkType;
  label?: string;
  className?: string;
}

/**
 * Pill button that copies the show's guest "magic" link (day sheet or door
 * list). Rendered below the Guest List section.
 */
export default function CopyGuestLinkButton({
  showId,
  linkType,
  label,
  className,
}: CopyGuestLinkButtonProps) {
  const { copyOrCreate, isPending } = useGuestLink(showId, linkType);
  const defaultLabel = linkType === "daysheet" ? "Magic Link" : "Door List Link";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`h-8 gap-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground ${className ?? ""}`}
      disabled={isPending}
      onClick={copyOrCreate}
    >
      <Sparkles className="h-3 w-3" />
      {label ?? defaultLabel}
    </Button>
  );
}
