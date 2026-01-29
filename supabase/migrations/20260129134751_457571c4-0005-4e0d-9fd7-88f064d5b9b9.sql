-- =============================================
-- Web Search Infrastructure: Cache & Trusted Domains
-- =============================================

-- Table for caching web search results (24h expiration)
CREATE TABLE public.web_search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('quick', 'deep')),
  serp_results JSONB,
  fetched_pages JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  hit_count INTEGER NOT NULL DEFAULT 0
);

-- Index for fast lookup by hash and expiration
CREATE INDEX idx_web_search_cache_hash ON public.web_search_cache(query_hash);
CREATE INDEX idx_web_search_cache_expires ON public.web_search_cache(expires_at);

-- Enable RLS (service role only for internal function use)
ALTER TABLE public.web_search_cache ENABLE ROW LEVEL SECURITY;

-- RLS: Only service role can access (edge functions)
CREATE POLICY "Service role full access on web_search_cache"
ON public.web_search_cache
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- Trusted Domains for Source Classification
-- =============================================

CREATE TABLE public.trusted_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('primary', 'official_mirror', 'aggregator')),
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for domain lookup
CREATE INDEX idx_trusted_domains_domain ON public.trusted_domains(domain);

-- Enable RLS
ALTER TABLE public.trusted_domains ENABLE ROW LEVEL SECURITY;

-- RLS: Public read access (for UI to show domain categories)
CREATE POLICY "Public can read trusted_domains"
ON public.trusted_domains
FOR SELECT
USING (true);

-- RLS: Only admins can modify
CREATE POLICY "Admins can modify trusted_domains"
ON public.trusted_domains
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Seed Initial Trusted Domains
-- =============================================

INSERT INTO public.trusted_domains (domain, category, priority, description) VALUES
  -- Primary Official Sources (highest trust)
  ('doweb.rio.rj.gov.br', 'primary', 100, 'Diário Oficial do Município do Rio (espelho oficial)'),
  ('diariodoamanha.rio', 'primary', 98, 'Diário Oficial do Rio de Janeiro (portal principal)'),
  ('prefeitura.rio', 'primary', 95, 'Portal oficial da Prefeitura do Rio de Janeiro'),
  ('rio.rj.gov.br', 'primary', 95, 'Domínio oficial do Governo do Rio de Janeiro'),
  ('gov.br', 'primary', 90, 'Portais federais e estaduais'),
  ('tcm.rj.gov.br', 'primary', 85, 'Tribunal de Contas do Município do Rio'),
  ('camara.rj.gov.br', 'primary', 80, 'Câmara Municipal do Rio de Janeiro'),
  ('procuradoria.prefeitura.rio', 'primary', 88, 'Procuradoria Geral do Município'),
  ('controladoria.prefeitura.rio', 'primary', 88, 'Controladoria Geral do Município'),
  ('educacao.prefeitura.rio', 'primary', 85, 'Secretaria Municipal de Educação'),
  ('saude.prefeitura.rio', 'primary', 85, 'Secretaria Municipal de Saúde'),
  ('fazenda.prefeitura.rio', 'primary', 85, 'Secretaria Municipal de Fazenda'),
  
  -- Official Mirrors (high trust, secondary)
  ('sei.rio.rj.gov.br', 'official_mirror', 92, 'Portal SEI!Rio oficial'),
  ('cgu.gov.br', 'official_mirror', 90, 'Controladoria Geral da União'),
  ('tcu.gov.br', 'official_mirror', 88, 'Tribunal de Contas da União'),
  ('planalto.gov.br', 'official_mirror', 88, 'Presidência da República - Legislação Federal'),
  
  -- Aggregators (useful but prefer primary sources)
  ('leismunicipais.com.br', 'aggregator', 60, 'Consolidador de legislação municipal'),
  ('jusbrasil.com.br', 'aggregator', 40, 'Referência jurídica - preferir fontes oficiais'),
  ('lexml.gov.br', 'aggregator', 65, 'Portal de legislação brasileira')
ON CONFLICT (domain) DO NOTHING;

-- =============================================
-- Cleanup Function for Expired Cache Entries
-- =============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_web_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.web_search_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- =============================================
-- Get Cached Web Search Result
-- =============================================

CREATE OR REPLACE FUNCTION public.get_cached_web_search(
  p_query_hash TEXT,
  p_mode TEXT
)
RETURNS TABLE(
  id UUID,
  serp_results JSONB,
  fetched_pages JSONB,
  hit_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update hit count and return result if not expired
  UPDATE public.web_search_cache wsc
  SET hit_count = wsc.hit_count + 1
  WHERE wsc.query_hash = p_query_hash
    AND wsc.mode = p_mode
    AND wsc.expires_at > now();
  
  RETURN QUERY
  SELECT 
    wsc.id,
    wsc.serp_results,
    wsc.fetched_pages,
    wsc.hit_count
  FROM public.web_search_cache wsc
  WHERE wsc.query_hash = p_query_hash
    AND wsc.mode = p_mode
    AND wsc.expires_at > now()
  LIMIT 1;
END;
$$;

-- =============================================
-- Save Web Search Result to Cache
-- =============================================

CREATE OR REPLACE FUNCTION public.save_web_search_cache(
  p_query_hash TEXT,
  p_query_text TEXT,
  p_mode TEXT,
  p_serp_results JSONB,
  p_fetched_pages JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Upsert: update if exists (same hash+mode), insert if not
  INSERT INTO public.web_search_cache (
    query_hash, query_text, mode, serp_results, fetched_pages
  ) VALUES (
    p_query_hash, p_query_text, p_mode, p_serp_results, p_fetched_pages
  )
  ON CONFLICT (query_hash) 
  DO UPDATE SET
    serp_results = EXCLUDED.serp_results,
    fetched_pages = EXCLUDED.fetched_pages,
    expires_at = now() + INTERVAL '24 hours',
    hit_count = web_search_cache.hit_count + 1
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Add unique constraint for upsert to work
ALTER TABLE public.web_search_cache 
ADD CONSTRAINT web_search_cache_hash_mode_unique UNIQUE (query_hash, mode);

-- =============================================
-- Get Domain Info for URL
-- =============================================

CREATE OR REPLACE FUNCTION public.get_domain_info(p_url TEXT)
RETURNS TABLE(
  domain TEXT,
  category TEXT,
  priority INTEGER,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain TEXT;
BEGIN
  -- Extract domain from URL (simple extraction)
  v_domain := regexp_replace(p_url, '^https?://([^/]+).*$', '\1');
  
  -- Try exact match first
  RETURN QUERY
  SELECT td.domain, td.category, td.priority, td.description
  FROM public.trusted_domains td
  WHERE td.domain = v_domain
  LIMIT 1;
  
  -- If no result, try partial match (subdomains)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT td.domain, td.category, td.priority, td.description
    FROM public.trusted_domains td
    WHERE v_domain LIKE '%' || td.domain
    ORDER BY td.priority DESC
    LIMIT 1;
  END IF;
END;
$$;