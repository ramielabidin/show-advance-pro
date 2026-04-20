import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildGuestUrl,
  generateGuestLink,
  getActiveGuestLink,
  type GuestLinkRow,
  type GuestLinkType,
} from "@/lib/guestLinks";

const SUCCESS_COPY: Record<GuestLinkType, string> = {
  daysheet: "Day sheet link copied",
  guestlist: "Door list link copied",
};

const SUCCESS_REGENERATE: Record<GuestLinkType, string> = {
  daysheet: "New day sheet link copied — old one revoked",
  guestlist: "New door list link copied — old one revoked",
};

export interface GuestLinkActions {
  activeLink: GuestLinkRow | null | undefined;
  isLoading: boolean;
  copyOrCreate: () => Promise<void>;
  regenerate: () => Promise<void>;
  isPending: boolean;
}

export function useGuestLink(showId: string, linkType: GuestLinkType): GuestLinkActions {
  const queryClient = useQueryClient();
  const queryKey = ["guest-link", showId, linkType];

  const { data: activeLink, isLoading } = useQuery({
    queryKey,
    queryFn: () => getActiveGuestLink(showId, linkType),
  });

  const copyToClipboard = async (token: string, message: string) => {
    try {
      await navigator.clipboard.writeText(buildGuestUrl(token));
      toast.success(message);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const mutation = useMutation({
    mutationFn: async (opts: { regenerate: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You must be signed in to create a share link");

      if (!opts.regenerate && activeLink) {
        await copyToClipboard(activeLink.token, SUCCESS_COPY[linkType]);
        return activeLink;
      }
      const created = await generateGuestLink(showId, linkType, userId);
      const message = opts.regenerate || activeLink
        ? SUCCESS_REGENERATE[linkType]
        : SUCCESS_COPY[linkType];
      await copyToClipboard(created.token, message);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    activeLink,
    isLoading,
    copyOrCreate: () => mutation.mutateAsync({ regenerate: false }).then(() => undefined),
    regenerate: () => mutation.mutateAsync({ regenerate: true }).then(() => undefined),
    isPending: mutation.isPending,
  };
}
