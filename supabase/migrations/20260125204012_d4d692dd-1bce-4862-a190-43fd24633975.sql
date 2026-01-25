-- =============================================
-- FIX: Restringir acesso à tabela profiles
-- Remover acesso anônimo e garantir que apenas usuários autenticados vejam seus próprios dados
-- =============================================

-- Remover políticas antigas que permitem acesso anônimo
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Criar novas políticas restritas a usuários autenticados
CREATE POLICY "Authenticated users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Negar acesso anônimo separadamente por operação
CREATE POLICY "Deny anon select on profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anon insert on profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Deny anon update on profiles"
ON public.profiles
FOR UPDATE
TO anon
USING (false);

CREATE POLICY "Deny anon delete on profiles"
ON public.profiles
FOR DELETE
TO anon
USING (false);

-- =============================================
-- FIX: Restringir chat_sessions a usuários autenticados
-- =============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert chat sessions" ON public.chat_sessions;

-- Criar novas políticas restritas
CREATE POLICY "Authenticated users can view own chat sessions" 
ON public.chat_sessions 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own chat sessions" 
ON public.chat_sessions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own chat sessions" 
ON public.chat_sessions 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own chat sessions" 
ON public.chat_sessions 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- FIX: Adicionar policies para rate_limits (RLS habilitado mas sem policies)
-- Apenas o service role deve acessar - negar acesso a todos os outros
-- =============================================

CREATE POLICY "Deny anon select on rate_limits"
ON public.rate_limits
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "Deny anon insert on rate_limits"
ON public.rate_limits
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny anon update on rate_limits"
ON public.rate_limits
FOR UPDATE
TO anon, authenticated
USING (false);

CREATE POLICY "Deny anon delete on rate_limits"
ON public.rate_limits
FOR DELETE
TO anon, authenticated
USING (false);

-- =============================================
-- FIX: Proteger user_roles contra modificações não autorizadas
-- =============================================

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Apenas visualização do próprio role para usuários autenticados
CREATE POLICY "Authenticated users can view own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Negar modificações por usuários (apenas service role pode modificar)
CREATE POLICY "Deny user insert to roles"
ON public.user_roles
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny user updates to roles"
ON public.user_roles
FOR UPDATE
TO anon, authenticated
USING (false);

CREATE POLICY "Deny user deletes to roles"
ON public.user_roles
FOR DELETE
TO anon, authenticated
USING (false);