-- Restringir RLS de frontend_errors: remover policy pública
DROP POLICY IF EXISTS "Anyone can insert frontend errors" ON public.frontend_errors;

-- Nova policy: apenas service_role pode inserir (edge function usa service_role)
CREATE POLICY "Service role can insert frontend errors" 
ON public.frontend_errors FOR INSERT
WITH CHECK (auth.role() = 'service_role');