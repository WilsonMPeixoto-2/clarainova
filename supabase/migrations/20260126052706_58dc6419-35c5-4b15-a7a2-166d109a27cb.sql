-- Create development_reports table for storing progress reports
CREATE TABLE public.development_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.development_reports ENABLE ROW LEVEL SECURITY;

-- Create policies - public access (admin validation done via ADMIN_KEY in frontend)
CREATE POLICY "Development reports are publicly readable"
ON public.development_reports
FOR SELECT
USING (true);

CREATE POLICY "Development reports can be inserted publicly"
ON public.development_reports
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Development reports can be updated publicly"
ON public.development_reports
FOR UPDATE
USING (true);

CREATE POLICY "Development reports can be deleted publicly"
ON public.development_reports
FOR DELETE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_development_reports_updated_at
BEFORE UPDATE ON public.development_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();