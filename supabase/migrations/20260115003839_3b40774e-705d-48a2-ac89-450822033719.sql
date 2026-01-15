-- Table for custom roles (admin stays as superuser via app_role enum)
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Role permissions - CRUD per module
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  module_id text NOT NULL,
  can_read boolean DEFAULT true,
  can_create boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role_id, module_id)
);

-- Junction table linking users to custom roles
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role_id)
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
CREATE POLICY "Admins can manage roles"
ON public.roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view roles"
ON public.roles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies for role_permissions table
CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view role permissions"
ON public.role_permissions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies for user_custom_roles table
CREATE POLICY "Admins can manage user custom roles"
ON public.user_custom_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own custom roles"
ON public.user_custom_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Create some default roles
INSERT INTO public.roles (name, description, is_system) VALUES
('Supervisor', 'Puede ver y editar pero no eliminar', true),
('Capturista', 'Solo puede crear registros', true),
('Consultor', 'Solo lectura en módulos asignados', true);

-- Add timestamp trigger
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();