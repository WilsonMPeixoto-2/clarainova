-- Create rate limiting table for edge function protection
CREATE TABLE public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(client_key, endpoint)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can manage rate limits
-- (No policies needed as service role bypasses RLS)

-- Create index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(client_key, endpoint, window_start);

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_client_key TEXT,
    p_endpoint TEXT,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, reset_in INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := now();
    v_window_start TIMESTAMPTZ;
BEGIN
    -- Calculate window start
    v_window_start := v_now - (p_window_seconds || ' seconds')::INTERVAL;
    
    -- Try to get existing record
    SELECT * INTO v_record
    FROM rate_limits
    WHERE client_key = p_client_key AND endpoint = p_endpoint
    FOR UPDATE;
    
    IF NOT FOUND THEN
        -- First request, create record
        INSERT INTO rate_limits (client_key, endpoint, request_count, window_start)
        VALUES (p_client_key, p_endpoint, 1, v_now);
        
        RETURN QUERY SELECT true, 1, p_window_seconds;
        RETURN;
    END IF;
    
    -- Check if window has expired
    IF v_record.window_start < v_window_start THEN
        -- Reset the window
        UPDATE rate_limits
        SET request_count = 1, window_start = v_now
        WHERE id = v_record.id;
        
        RETURN QUERY SELECT true, 1, p_window_seconds;
        RETURN;
    END IF;
    
    -- Within window, check count
    IF v_record.request_count >= p_max_requests THEN
        -- Rate limited
        RETURN QUERY SELECT 
            false, 
            v_record.request_count, 
            EXTRACT(EPOCH FROM (v_record.window_start + (p_window_seconds || ' seconds')::INTERVAL - v_now))::INTEGER;
        RETURN;
    END IF;
    
    -- Increment count
    UPDATE rate_limits
    SET request_count = request_count + 1
    WHERE id = v_record.id;
    
    RETURN QUERY SELECT true, v_record.request_count + 1, 
        EXTRACT(EPOCH FROM (v_record.window_start + (p_window_seconds || ' seconds')::INTERVAL - v_now))::INTEGER;
END;
$$;

-- Function to clean up old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < now() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;