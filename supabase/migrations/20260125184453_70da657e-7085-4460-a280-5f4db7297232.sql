-- Add explicit policy to deny anonymous access to profiles table
-- This ensures only authenticated users can access the profiles table

-- Drop existing SELECT policy and recreate with explicit authenticated check
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate with explicit authenticated role check
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Update INSERT policy to be explicit about authenticated role
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Update UPDATE policy to be explicit about authenticated role  
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);