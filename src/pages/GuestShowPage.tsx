import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link2Off } from "lucide-react";
import { fetchGuestShow } from "@/lib/guestLinks";
import GuestLayout from "@/components/guest/GuestLayout";
import DaysheetGuestView from "@/components/guest/DaysheetGuestView";
import DoorListGuestView from "@/components/guest/DoorListGuestView";

export default function GuestShowPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["guest-show", token],
    queryFn: () => fetchGuestShow(token!),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <GuestLayout>
        <div className="space-y-3 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </GuestLayout>
    );
  }

  if (isError || !data) {
    return (
      <GuestLayout>
        <div className="pt-10 sm:pt-16 flex flex-col items-center text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <Link2Off className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl tracking-[-0.02em] mb-1">
            This link is no longer active.
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask whoever shared it for a fresh one.
          </p>
        </div>
      </GuestLayout>
    );
  }

  return (
    <GuestLayout>
      {data.link_type === "daysheet" ? (
        <DaysheetGuestView show={data} token={token!} />
      ) : (
        <DoorListGuestView show={data} />
      )}
    </GuestLayout>
  );
}
