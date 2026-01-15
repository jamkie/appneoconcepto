-- Drop the old admin-only delete policy
DROP POLICY IF EXISTS "Admins delete avances" ON public.avances;

-- Create a new policy that checks both admin role AND granular permissions
CREATE POLICY "Delete avances with permissions"
ON public.avances
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'avances'
      AND can_delete = true
  )
);

-- Also update avance_items to allow deletion when user can delete avances
DROP POLICY IF EXISTS "Admins delete avance items" ON public.avance_items;

CREATE POLICY "Delete avance items with permissions"
ON public.avance_items
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'avances'
      AND can_delete = true
  )
);