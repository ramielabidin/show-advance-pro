import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BUCKET = "inbound-attachments";
const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

interface Props {
  showId: string;
}

export default function ShowAttachments({ showId }: Props) {
  const { teamId } = useTeam();
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["inbound-attachments", showId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_email_attachments")
        .select("id, storage_path, original_filename, content_type, size_bytes, created_at")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!teamId) throw new Error("No team selected");
      if (file.type !== "application/pdf") throw new Error("Only PDF files are supported");
      if (file.size > MAX_BYTES) throw new Error("File too large (max 25MB)");

      const storagePath = `${teamId}/manual/${showId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("inbound_email_attachments").insert({
        team_id: teamId,
        show_id: showId,
        storage_path: storagePath,
        original_filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
      });
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-attachments", showId] });
      toast.success("Attachment added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const att = attachments.find((a) => a.id === id);
      if (!att) return;
      await supabase.storage.from(BUCKET).remove([att.storage_path]);
      const { error } = await supabase.from("inbound_email_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-attachments", showId] });
      toast.success("Attachment removed");
    },
    onError: () => toast.error("Failed to remove attachment"),
  });

  const openAttachment = async (id: string, storagePath: string) => {
    setOpening(id);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60);
      if (error || !data?.signedUrl) {
        toast.error("Could not open attachment");
        return;
      }
      window.open(data.signedUrl, "_blank");
    } finally {
      setOpening(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2 font-sans">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          Attachments
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending || !teamId}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add PDF
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {isLoading ? (
        <div className="h-12 rounded-md bg-muted animate-pulse" />
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <button
                type="button"
                onClick={() => openAttachment(att.id, att.storage_path)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:underline"
                disabled={opening === att.id}
              >
                {opening === att.id ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{att.original_filename}</p>
                  {att.size_bytes ? (
                    <p className="text-xs text-muted-foreground">{formatSize(att.size_bytes)}</p>
                  ) : null}
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                onClick={() => setPendingDeleteId(att.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              The file will be permanently deleted from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
