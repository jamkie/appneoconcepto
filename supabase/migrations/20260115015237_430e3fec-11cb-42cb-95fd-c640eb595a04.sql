-- Crear tabla de permisos directos por usuario
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id TEXT NOT NULL,
  submodule_id TEXT DEFAULT NULL,
  can_read BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crear índice único para evitar duplicados
CREATE UNIQUE INDEX user_permissions_unique_idx ON public.user_permissions (user_id, module_id, COALESCE(submodule_id, ''));

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage user_permissions" ON public.user_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Eliminar tablas obsoletas del sistema de roles personalizado
DROP TABLE IF EXISTS public.user_custom_roles;
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.roles;