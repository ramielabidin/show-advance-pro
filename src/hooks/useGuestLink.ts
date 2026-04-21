import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { copyTextViaPromise } from "@/lib/clipboard";
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
  copyOrCreate: () => void;
  isPending: boolean;
}

export function useGuestLink(showId: string, linkType: GuestLinkType): GuestLinkActions {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const queryKey = ["guest-link", showId, linkType];
  const [isPending, setIsPending] = useState(false);

  const { data: activeLink, isLoading } = useQuery({
    queryKey,
    queryFn: () => getActiveGuestLink(showId, linkType),
  });

  // Safari strictly enforces that `navigator.clipboard.write` be called
  // synchronously within a user gesture. We must not await anything before
  // invoking `copyTextViaPromise` — instead we hand it a Promise that resolves
  // to the URL once the link has been created.
  const copyOrCreate = () => {
    const userId = session?.user?.id;
    if (!userId) {
      toast.error("You must be signed in to create a share link");
      return;
    }
    if (isPending) return;

    const willCreateNew = !activeLink;

    const urlPromise: Promise<string> = willCreateNew
      ? generateGuestLink(showId, linkType, userId).then((created) =>
          buildGuestUrl(created.token),
        )
      : Promise.resolve(buildGuestUrl(activeLink!.token));

    setIsPending(true);

    // Kick off the clipboard write synchronously so Safari sees it under the
    // same user gesture that triggered the click.
    const clipboardPromise = copyTextViaPromise(urlPromise);

    Promise.allSettled([urlPromise, clipboardPromise]).then(([urlResult, clipResult]) => {
      setIsPending(false);
      if (urlResult.status === "rejected") {
        const err = urlResult.reason as Error;
        toast.error(err?.message ?? "Could not create share link");
        return;
      }
      if (clipResult.status === "rejected") {
        toast.error("Could not copy to clipboard");
        return;
      }
      toast.success(SUCCESS_COPY[linkType]);
      if (willCreateNew) {
        queryClient.invalidateQueries({ queryKey });
      }
    });
  };

  return {
    activeLink,
    isLoading,
    copyOrCreate,
    isPending,
  };
}
