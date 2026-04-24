import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import GuestListEditor, { parseGuestList, serializeGuestList } from "@/components/GuestListEditor";
import { updateGuestListByToken } from "@/lib/guestLinks";
import { toast } from "sonner";

interface GuestGuestListProps {
  token: string;
  initialValue: string | null;
  compsAllotment?: string | null;
}

export default function GuestGuestList({ token, initialValue, compsAllotment }: GuestGuestListProps) {
  const [savedValue, setSavedValue] = useState<string>(initialValue ?? "[]");
  const [draftValue, setDraftValue] = useState<string>(initialValue ?? "[]");
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    const next = initialValue ?? "[]";
    setSavedValue(next);
    setDraftValue(next);
    setEditorKey((k) => k + 1);
  }, [initialValue]);

  const mutation = useMutation({
    mutationFn: (serialized: string) => updateGuestListByToken(token, serialized),
    onSuccess: (_data, variables) => {
      setSavedValue(variables);
      setEditorKey((k) => k + 1);
      toast.success("Guest list saved");
    },
    onError: (err: Error) => toast.error(err.message || "Could not save guest list"),
  });

  const draftNormalized = serializeGuestList(parseGuestList(draftValue));
  const savedNormalized = serializeGuestList(parseGuestList(savedValue));
  const isDirty = draftNormalized !== savedNormalized;

  const handleCancel = () => {
    setDraftValue(savedValue);
    setEditorKey((k) => k + 1);
  };

  const handleSave = () => {
    mutation.mutate(draftNormalized);
  };

  return (
    <div className="space-y-2">
      <GuestListEditor
        key={editorKey}
        value={draftValue}
        compsAllotment={compsAllotment}
        onChange={setDraftValue}
      />
      {isDirty && (
        <div className="flex items-center gap-1.5 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={mutation.isPending}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={mutation.isPending}
            className="h-7 text-xs"
          >
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
        </div>
      )}
    </div>
  );
}
