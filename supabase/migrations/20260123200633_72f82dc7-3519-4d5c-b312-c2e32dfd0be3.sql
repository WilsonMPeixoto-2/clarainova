-- Add explicit restrictive storage policies for knowledge-base bucket
-- This prevents accidental write access if future migrations add permissive policies

-- Policy: Only service role can insert files into knowledge-base bucket
CREATE POLICY "Service role can upload to knowledge-base"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'knowledge-base' AND false);

-- Policy: Only service role can update files in knowledge-base bucket  
CREATE POLICY "Service role can update knowledge-base files"
ON storage.objects
FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'knowledge-base' AND false);

-- Policy: Only service role can delete files from knowledge-base bucket
CREATE POLICY "Service role can delete knowledge-base files"
ON storage.objects
FOR DELETE
TO authenticated, anon
USING (bucket_id = 'knowledge-base' AND false);