import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface TeamContextType {
  team: Team | null;
  teamId: string | null;
  isOwner: boolean;
  loading: boolean;
}

const TeamContext = createContext<TeamContextType>({
  team: null,
  teamId: null,
  isOwner: false,
  loading: true,
});

export function useTeam() {
  return useContext(TeamContext);
}

function CreateTeamScreen() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const teamId = crypto.randomUUID();

      const { error } = await supabase
        .from("teams")
        .insert({ id: teamId, name: name.trim(), created_by: user.id });
      if (error) throw error;

      // Add self as owner
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({ team_id: teamId, user_id: user.id, role: "owner" });
      if (memberError) throw memberError;

      // Create app_settings row for this team
      const { error: settingsError } = await supabase.from("app_settings").insert({ team_id: teamId });
      if (settingsError) throw settingsError;

      queryClient.invalidateQueries({ queryKey: ["user-teams"] });
      toast.success("Team created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Advance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a team to get started. You'll be able to invite your crew later.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juice"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full">
            {loading ? "Creating…" : "Create Team"}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          If you've been invited to a team, it will appear automatically.
        </p>
        <div className="text-center">
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const { data: membership, isLoading } = useQuery({
    queryKey: ["user-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, teams(id, name, created_by, created_at)")
        .eq("user_id", session!.user.id)
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!session,
  });

  const team = (membership as any)?.teams as Team | null;
  const teamId = team?.id ?? null;
  const isOwner = membership?.role === "owner";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!team) {
    return <CreateTeamScreen />;
  }

  return (
    <TeamContext.Provider value={{ team, teamId, isOwner, loading: isLoading }}>
      {children}
    </TeamContext.Provider>
  );
}
