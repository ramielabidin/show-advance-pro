
-- Create the band_documents table
CREATE TABLE IF NOT EXISTS public.band_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  slot TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT band_documents_team_slot_unique UNIQUE (team_id, slot)
);

ALTER TABLE public.band_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view band documents"
ON public.band_documents FOR SELECT TO authenticated
USING (team_id IN (SELECT user_team_ids(auth.uid())));

CREATE POLICY "Team members can insert band documents"
ON public.band_documents FOR INSERT TO authenticated
WITH CHECK (team_id IN (SELECT user_team_ids(auth.uid())));

CREATE POLICY "Team members can update band documents"
ON public.band_documents FOR UPDATE TO authenticated
USING (team_id IN (SELECT user_team_ids(auth.uid())));

CREATE POLICY "Team members can delete band documents"
ON public.band_documents FOR DELETE TO authenticated
USING (team_id IN (SELECT user_team_ids(auth.uid())));

DROP TRIGGER IF EXISTS update_band_documents_updated_at ON public.band_documents;
CREATE TRIGGER update_band_documents_updated_at
BEFORE UPDATE ON public.band_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('band-documents', 'band-documents', true);

-- Storage policies
CREATE POLICY "Team members can upload band documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'band-documents');

CREATE POLICY "Anyone can view band documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'band-documents');

CREATE POLICY "Team members can delete band documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'band-documents');
