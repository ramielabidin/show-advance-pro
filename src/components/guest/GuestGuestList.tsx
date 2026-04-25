import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import GuestListEditor from "@/components/GuestListEditor";
import { updateGuestListByToken } from "@/lib/guestLinks";
import { toast } from "sonner";

interface GuestGuestListProps {
  token: string;
  initialValue: string | null;
  compsAllotment?: string | null;
}

export default function GuestGuestList({ token, initialValue, compsAllotment }: GuestGuestListProps) {
  const [savedValue, setSavedValue] = useState<string>(initialValue ?? "[]");

  useEffect(() => {
    setSavedValue(initialValue ?? "[]");
  }, [initialValue]);

  const mutation = useMutation({
    mutationFn: (serialized: string) => updateGuestListByToken(token, serialized),
    onSuccess: (_data, variables) => setSavedValue(variables),
    onError: (err: Error) => toast.error(err.message || "Could not save guest list"),
  });

  return (
    <GuestListEditor
      value={savedValue}
      compsAllotment={compsAllotment}
      onChange={(serialized) => mutation.mutate(serialized)}
    />
  );
}
