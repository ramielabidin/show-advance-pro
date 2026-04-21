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

export interface GuestLinkActions {
  activeLink: GuestLinkRow | null | undefined;
  isLoading: boolean;
  copyOrCreate: () => Promise<void>;
  isPending: boolean;
}

export function useGuestLink(showId: string, linkType: GuestLinkType): GuestLinkActions {
  const queryClient = useQueryClient();
  const queryKey = ["guest-link", showId, linkType];

  const { data: activeLink, isLoading } = useQuery({
    queryKey,
    queryFn: () => getActiveGuestLink(showId, linkType),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You must be signed in to create a share link");
      return generateGuestLink(showId, linkType, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Safari restricts `navigator.clipboard.writeText` to code paths that run
  // synchronously within a user gesture. React Query's `mutateAsync` plus any
  // `await` before the write drops that gesture, producing "Could not copy to
  // clipboard" errors. Two code paths keep the gesture alive:
  //   1. When an active link already exists, call `writeText` directly inside
  //      the click handler — no `await` before it.
  //   2. When the link must be generated first, use `clipboard.write` with a
  //      `ClipboardItem` whose payload is a Promise. Safari holds the user
  //      activation window until that promise resolves.
  const copyOrCreate = async () => {
    try {
      if (activeLink) {
        await navigator.clipboard.writeText(buildGuestUrl(activeLink.token));
        toast.success(SUCCESS_COPY[linkType]);
        return;
      }

      const textPromise = (async () => {
        const created = await createMutation.mutateAsync();
        return new Blob([buildGuestUrl(created.token)], { type: "text/plain" });
      })();

      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": textPromise }),
        ]);
      } else {
        const blob = await textPromise;
        await navigator.clipboard.writeText(await blob.text());
      }
      toast.success(SUCCESS_COPY[linkType]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy to clipboard");
    }
  };

  return {
    activeLink,
    isLoading,
    copyOrCreate,
    isPending: createMutation.isPending,
  };
}
