CREATE TABLE IF NOT EXISTS public.tours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON public.tours FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS update_tours_updated_at ON public.tours;
CREATE TRIGGER update_tours_updated_at BEFORE UPDATE ON public.tours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shows ADD COLUMN tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL;