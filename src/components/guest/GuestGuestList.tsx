import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import GuestListEditor from "@/components/GuestListEditor";
import { updateGuestListByToken } from "@/lib/guestLinks";
import { toast } from "sonner";

interface GuestGuestListProps {
  token: string;
  initialValue: string | null;
  compsAllotment?: string | null;
}

const DEBOUNCE_MS = 600;

export default function GuestGuestList({ token, initialValue, compsAllotment }: GuestGuestListProps) {
  const [value, setValue] = useState<string>(initialValue ?? "[]");
  const [savedTick, setSavedTick] = useState(false);
  const didHydrate = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: (serialized: string) => updateGuestListByToken(token, serialized),
    onSuccess: () => {
      setSavedTick(true);
      window.setTimeout(() => setSavedTick(false), 1600);
    },
    onError: (err: Error) => toast.error(err.message || "Could not save guest list"),
  });

  useEffect(() => {
    // Skip the initial hydration write that GuestListEditor emits from its
    // `useEffect` on mount — only persist changes the user actually made.
    if (!didHydrate.current) {
      didHydrate.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const serialized = value;
    debounceRef.current = setTimeout(() => {
      mutation.mutate(serialized);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <GuestListEditor
        value={value}
        compsAllotment={compsAllotment}
        onChange={setValue}
      />
      <div className="h-4 flex items-center text-[11px] text-muted-foreground">
        {mutation.isPending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        ) : savedTick ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--pastel-green-fg)]">
            <Check className="h-3 w-3" /> Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}
