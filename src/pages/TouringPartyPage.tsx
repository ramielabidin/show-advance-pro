import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";

interface MemberForm {
  name: string;
  email: string;
  phone: string;
}

const emptyForm: MemberForm = { name: "", email: "", phone: "" };

export default function TouringPartyPage() {
  const queryClient = useQueryClient();
  const { teamId } = useTeam();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["touring-party"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("touring_party_members")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (m: MemberForm) => {
      const { error } = await supabase.from("touring_party_members").insert({ ...m, team_id: teamId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["touring-party"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Member added");
    },
    onError: () => toast.error("Failed to add member"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...m }: MemberForm & { id: string }) => {
      const { error } = await supabase
        .from("touring_party_members")
        .update(m)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["touring-party"] });
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Member updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("touring_party_members")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["touring-party"] });
      toast.success("Member removed");
    },
  });

  const startEdit = (m: typeof members[0]) => {
    setEditingId(m.id);
    setForm({ name: m.name, email: m.email, phone: m.phone });
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight">Touring Party</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Member</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 sm:h-9" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 sm:h-9" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 sm:h-9" />
              </div>
              <Button
                className="w-full h-11 sm:h-9"
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || createMutation.isPending}
              >
                Add Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add people to your touring party. They'll be available to assign to any show."
        />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border bg-card p-3 sm:p-4 animate-fade-in gap-3"
            >
              {editingId === m.id ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="h-11 sm:h-9" />
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="h-11 sm:h-9" />
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="h-11 sm:h-9" />
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="font-medium text-foreground text-sm sm:text-base">{m.name}</div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 mt-0.5">
                    {m.email && <span className="text-sm text-muted-foreground truncate">{m.email}</span>}
                    {m.phone && <span className="text-sm font-mono text-muted-foreground">{m.phone}</span>}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                {editingId === m.id ? (
                  <>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => updateMutation.mutate({ id: m.id, ...form })}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => startEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Remove this member?")) deleteMutation.mutate(m.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
