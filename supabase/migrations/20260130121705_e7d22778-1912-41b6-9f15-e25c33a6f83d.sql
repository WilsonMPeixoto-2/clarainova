-- Neutralize legacy plain IPs in rate_limits table (LGPD compliance)
-- Replace raw IPs with redacted markers
UPDATE public.rate_limits
SET client_key = 'legacy_redacted_' || id::text
WHERE client_key ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}';

-- Also handle IPs with port/endpoint suffix (e.g., "191.57.19.69:admin-auth")
UPDATE public.rate_limits
SET client_key = 'legacy_redacted_' || id::text
WHERE client_key ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:';

-- Data retention: clean records older than 30 days
DELETE FROM public.rate_limits
WHERE window_start < NOW() - INTERVAL '30 days';