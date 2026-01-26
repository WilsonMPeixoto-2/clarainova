-- Create table to track API provider usage
CREATE TABLE public.api_usage_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'lovable')),
  model TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('fast', 'deep')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_api_usage_stats_created_at ON public.api_usage_stats(created_at DESC);
CREATE INDEX idx_api_usage_stats_provider ON public.api_usage_stats(provider);

-- Enable RLS (admin-only access via service role)
ALTER TABLE public.api_usage_stats ENABLE ROW LEVEL SECURITY;

-- No public policies - only accessible via service role (edge functions)
-- Admin reads via edge function that uses service role

-- Create a function to get usage stats for admin dashboard
CREATE OR REPLACE FUNCTION public.get_api_usage_stats(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  provider TEXT,
  model TEXT,
  mode TEXT,
  total_count BIGINT,
  date DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aus.provider,
    aus.model,
    aus.mode,
    COUNT(*)::BIGINT as total_count,
    DATE(aus.created_at) as date
  FROM api_usage_stats aus
  WHERE aus.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY aus.provider, aus.model, aus.mode, DATE(aus.created_at)
  ORDER BY date DESC, aus.provider;
END;
$$;

-- Create a summary function for quick stats
CREATE OR REPLACE FUNCTION public.get_api_usage_summary(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  provider TEXT,
  total_count BIGINT,
  percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total count first
  SELECT COUNT(*) INTO v_total
  FROM api_usage_stats
  WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT 
    aus.provider,
    COUNT(*)::BIGINT as total_count,
    CASE 
      WHEN v_total > 0 THEN ROUND((COUNT(*)::NUMERIC / v_total) * 100, 1)
      ELSE 0
    END as percentage
  FROM api_usage_stats aus
  WHERE aus.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY aus.provider
  ORDER BY total_count DESC;
END;
$$;