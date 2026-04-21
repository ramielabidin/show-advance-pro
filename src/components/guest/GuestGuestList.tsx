import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import GuestListEditor, { GuestListView, parseGuestList } from "@/components/GuestListEditor";
import { updateGuestListByToken } from "@/lib/guestLinks";
import { toast } from "sonner";

interface GuestGuestListProps {
  token: string;
  initialValue: string | null;
  compsAllotment?: string | null;
}

export default function GuestGuestList({ token, initialValue, compsAllotment }: GuestGuestListProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [savedValue, setSavedValue] = useState<string>(initialValue ?? "[]");
  const [draftValue, setDraftValue] = useState<string>(initialValue ?? "[]");

  const mutation = useMutation({
    mutationFn: (serialized: string) => updateGuestListByToken(token, serialized),
    onSuccess: (_data, variables) => {
      setSavedValue(variables);
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message || "Could not save guest list"),
  });

  const startEditing = () => {
    setDraftValue(savedValue);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    mutation.mutate(draftValue);
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <GuestListEditor
          value={draftValue}
          compsAllotment={compsAllotment}
          onChange={setDraftValue}
          isInline
        />
        <div className="flex items-center gap-1.5 pt-1">
          <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={mutation.isPending} className="h-7 text-xs">
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
        </div>
      </div>
    );
  }

  const entries = parseGuestList(savedValue);
  if (entries.length === 0) {
    return (
      <button
        onClick={startEditing}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" /> Add guests
      </button>
    );
  }

  return (
    <GuestListView
      value={savedValue}
      compsAllotment={compsAllotment}
      onEdit={startEditing}
    />
  );
}
