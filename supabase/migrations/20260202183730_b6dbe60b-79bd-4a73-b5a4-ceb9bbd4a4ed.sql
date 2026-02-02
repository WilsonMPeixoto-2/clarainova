-- Enable realtime for documents table to allow status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;