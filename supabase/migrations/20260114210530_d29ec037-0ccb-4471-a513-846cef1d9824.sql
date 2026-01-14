-- Update can_access_obra function to allow all authenticated users to view data
CREATE OR REPLACE FUNCTION public.can_access_obra(_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Also update the View obras policy to allow all authenticated users
DROP POLICY IF EXISTS "View obras" ON public.obras;
CREATE POLICY "View obras" ON public.obras
FOR SELECT TO authenticated
USING (true);

-- Update supervisors policy to allow all authenticated users to view
DROP POLICY IF EXISTS "Supervisors can view obras" ON public.obras;

-- Ensure instaladores are visible to all authenticated users
DROP POLICY IF EXISTS "View instaladores" ON public.instaladores;
CREATE POLICY "View instaladores" ON public.instaladores
FOR SELECT TO authenticated
USING (true);