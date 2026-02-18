
-- =============================================
-- Actualizar RLS para permitir usuarios con permisos granulares en destajos/cortes
-- =============================================

-- =============================================
-- 1. cortes_semanales
-- =============================================
DROP POLICY IF EXISTS "Admins can manage cortes" ON public.cortes_semanales;

CREATE POLICY "Insert cortes with permission"
ON public.cortes_semanales FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_create = true
  )
);

CREATE POLICY "Update cortes with permission"
ON public.cortes_semanales FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_update = true
  )
);

CREATE POLICY "Delete cortes with permission"
ON public.cortes_semanales FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_delete = true
  )
);

-- =============================================
-- 2. corte_instaladores
-- =============================================
DROP POLICY IF EXISTS "Admins manage corte instaladores" ON public.corte_instaladores;

CREATE POLICY "Insert corte instaladores with permission"
ON public.corte_instaladores FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_create = true
  )
);

CREATE POLICY "Update corte instaladores with permission"
ON public.corte_instaladores FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_update = true
  )
);

CREATE POLICY "Delete corte instaladores with permission"
ON public.corte_instaladores FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_delete = true
  )
);

-- =============================================
-- 3. saldos_instaladores
-- =============================================
DROP POLICY IF EXISTS "Admins manage saldos instaladores" ON public.saldos_instaladores;

CREATE POLICY "Insert saldos instaladores with permission"
ON public.saldos_instaladores FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_update = true
  )
);

CREATE POLICY "Update saldos instaladores with permission"
ON public.saldos_instaladores FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_update = true
  )
);

CREATE POLICY "Delete saldos instaladores admin only"
ON public.saldos_instaladores FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================
-- 4. pagos_destajos
-- =============================================
DROP POLICY IF EXISTS "Admins insert pagos destajos" ON public.pagos_destajos;
DROP POLICY IF EXISTS "Admins update pagos destajos" ON public.pagos_destajos;
DROP POLICY IF EXISTS "Admins delete pagos destajos" ON public.pagos_destajos;

CREATE POLICY "Insert pagos destajos with permission"
ON public.pagos_destajos FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'pagos'
      AND can_create = true
  )
);

CREATE POLICY "Update pagos destajos with permission"
ON public.pagos_destajos FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'pagos'
      AND can_update = true
  )
);

CREATE POLICY "Delete pagos destajos with permission"
ON public.pagos_destajos FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'pagos'
      AND can_delete = true
  )
);

-- =============================================
-- 5. solicitudes_pago
-- =============================================
DROP POLICY IF EXISTS "Admins update solicitudes" ON public.solicitudes_pago;
DROP POLICY IF EXISTS "Admins delete solicitudes" ON public.solicitudes_pago;

CREATE POLICY "Update solicitudes with permission"
ON public.solicitudes_pago FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_update = true
  )
);

CREATE POLICY "Delete solicitudes with permission"
ON public.solicitudes_pago FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid()
      AND module_id = 'destajos'
      AND submodule_id = 'cortes'
      AND can_delete = true
  )
);
