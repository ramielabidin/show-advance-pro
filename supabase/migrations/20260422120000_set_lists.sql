-- Set list feature
--   1. `songs` table: team-scoped catalog of songs a band can pull from when
--      building a set list. Title only (MVP).
--   2. `shows.set_list` jsonb column: ordered array of set list entries for
--      this show. Entry shapes:
--        { "kind": "song", "song_id": "<uuid>", "title": "<snapshot>" }
--        { "kind": "custom", "title": "<one-off>" }
--        { "kind": "note",   "text": "<note>" }
--      The snapshotted title on song entries means catalog deletes/renames
--      do not rewrite history or break old set lists.

CREATE TABLE IF NOT EXISTS public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS songs_team_id_idx ON public.songs(team_id);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view songs"
  ON public.songs FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can insert songs"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can update songs"
  ON public.songs FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can delete songs"
  ON public.songs FOR DELETE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS set_list JSONB;
