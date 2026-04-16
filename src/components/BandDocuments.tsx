import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

const DOCUMENT_SLOTS = [
  { key: "stage_plot", label: "Stage Plot / Input List" },
  { key: "hospitality_rider", label: "Hospitality Rider" },
  { key: "technical_rider", label: "Technical Rider" },
  { key: "band_bio", label: "Band Bio" },
  { key: "press_photos", label: "Press Photos" },
] as const;

type SlotKey = (typeof DOCUMENT_SLOTS)[number]["key"];

interface BandDocument {
  id: string;
  team_id: string;
  slot: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

export default function BandDocuments() {
  const { teamId } = useTeam();
  const queryClient = useQueryClient();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["band-documents", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_documents")
        .select("*")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data as BandDocument[];
    },
    enabled: !!teamId,
  });

  const docMap = new Map(documents.map((d) => [d.slot, d]));

  const uploadMutation = useMutation({
    mutationFn: async ({ slot, file }: { slot: SlotKey; file: File }) => {
      const filePath = `${teamId}/${slot}/${file.name}`;

      // Delete old file if exists
      const existing = docMap.get(slot);
      if (existing) {
        await supabase.storage.from("band-documents").remove([existing.file_path]);
        await supabase.from("band_documents").delete().eq("id", existing.id);
      }

      const { error: uploadError } = await supabase.storage
        .from("band-documents")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("band_documents").insert({
        team_id: teamId!,
        slot,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-documents", teamId] });
      toast.success("Document uploaded");
    },
    onError: () => toast.error("Failed to upload document"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: BandDocument) => {
      await supabase.storage.from("band-documents").remove([doc.file_path]);
      const { error } = await supabase.from("band_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-documents", teamId] });
      toast.success("Document removed");
    },
    onError: () => toast.error("Failed to remove document"),
  });

  const openDocument = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("band-documents")
      .createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not open document");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-medium text-foreground mb-0.5">Band Documents</h2>
        <p className="text-sm text-muted-foreground">
          Store your standard advance documents here for easy access when venues request them.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {DOCUMENT_SLOTS.map(({ key, label }) => {
            const doc = docMap.get(key);
            return (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border px-3 py-2.5 gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  {doc ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {doc.file_name}
                      </span>
                      {doc.file_size && (
                        <span className="text-xs text-muted-foreground">
                          · {formatSize(doc.file_size)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        · {format(new Date(doc.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">No file uploaded</p>
                  )}
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                  {doc && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openDocument(doc.file_path)}
                        title="View / Download"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Remove this document?")) deleteMutation.mutate(doc);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <input
                    type="file"
                    ref={(el) => { fileInputRefs.current[key] = el; }}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMutation.mutate({ slot: key, file });
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => fileInputRefs.current[key]?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {doc ? "Replace" : "Upload"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
