-- Drop all existing permissive "Public access" policies
DROP POLICY IF EXISTS "Public access" ON public.app_settings;
DROP POLICY IF EXISTS "Public access" ON public.schedule_entries;
DROP POLICY IF EXISTS "Public access" ON public.show_party_members;
DROP POLICY IF EXISTS "Public access" ON public.shows;
DROP POLICY IF EXISTS "Public access" ON public.touring_party_members;
DROP POLICY IF EXISTS "Public access" ON public.tours;

-- app_settings: authenticated users can read and update
CREATE POLICY "Authenticated read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update" ON public.app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- schedule_entries: authenticated full access
CREATE POLICY "Authenticated access" ON public.schedule_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- show_party_members: authenticated full access
CREATE POLICY "Authenticated access" ON public.show_party_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- shows: authenticated full access
CREATE POLICY "Authenticated access" ON public.shows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- touring_party_members: authenticated full access
CREATE POLICY "Authenticated access" ON public.touring_party_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tours: authenticated full access
CREATE POLICY "Authenticated access" ON public.tours FOR ALL TO authenticated USING (true) WITH CHECK (true);