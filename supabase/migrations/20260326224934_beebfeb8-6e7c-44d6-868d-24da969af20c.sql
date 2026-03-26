-- Fix: Allow authenticated users with destajos permissions to update anticipos
-- This is needed because the ApplyAnticipoModal updates monto_disponible
-- but the current RLS only allows admins, causing silent failures for non-admin users

CREATE POLICY "Update anticipos with permission"
ON public.anticipos
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.module_id = 'destajos'
      AND user_permissions.can_update = true
  ))
);

-- Reconcile data: reduce monto_disponible for anticipos that have aplicacion_anticipo solicitudes
-- but whose monto_disponible was never reduced due to the RLS bug

-- Fix anticipo 961917c1 (TRU HOTEL AEROPUERTO ESQUINEROS - $2,000 applied but not reduced)
UPDATE public.anticipos 
SET monto_disponible = GREATEST(0, monto_disponible - 2000)
WHERE id = '961917c1-b271-4286-901b-e4d41111f04d' 
  AND monto_disponible = 2000;