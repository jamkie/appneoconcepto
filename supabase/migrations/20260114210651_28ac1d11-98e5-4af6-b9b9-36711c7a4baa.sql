-- Drop the restrictive policy that only allows supervisors to see assigned obras
DROP POLICY IF EXISTS "Supervisors can view assigned obras" ON public.obras;

-- Drop the admin-only select policy since we want all users to see
DROP POLICY IF EXISTS "Admins can select obras" ON public.obras;

-- Create a permissive policy allowing all authenticated users to view obras
CREATE POLICY "All authenticated users can view obras" ON public.obras
FOR SELECT TO authenticated
USING (true);

-- Also update obra_instaladores to allow all authenticated users to view
DROP POLICY IF EXISTS "View obra instaladores" ON public.obra_instaladores;
CREATE POLICY "View obra instaladores" ON public.obra_instaladores
FOR SELECT TO authenticated
USING (true);

-- Update obra_items to allow all authenticated users to view
DROP POLICY IF EXISTS "View obra items" ON public.obra_items;
CREATE POLICY "View obra items" ON public.obra_items
FOR SELECT TO authenticated
USING (true);

-- Update obra_supervisores to allow all authenticated users to view
DROP POLICY IF EXISTS "View own assignments" ON public.obra_supervisores;
CREATE POLICY "View obra supervisores" ON public.obra_supervisores
FOR SELECT TO authenticated
USING (true);