-- Create permission_templates table
CREATE TABLE public.permission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create permission_template_items table
CREATE TABLE public.permission_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.permission_templates(id) ON DELETE CASCADE NOT NULL,
  module_id text NOT NULL,
  submodule_id text,
  can_read boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false
);

-- Create unique index for template items
CREATE UNIQUE INDEX idx_template_items_unique 
ON public.permission_template_items (template_id, module_id, COALESCE(submodule_id, ''));

-- Enable RLS
ALTER TABLE public.permission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_template_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for permission_templates
CREATE POLICY "Admins can manage templates"
ON public.permission_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view templates"
ON public.permission_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS policies for permission_template_items
CREATE POLICY "Admins can manage template items"
ON public.permission_template_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view template items"
ON public.permission_template_items FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Seed initial templates
INSERT INTO public.permission_templates (name, description) VALUES
('Solo lectura', 'Acceso de solo lectura a todos los módulos'),
('Capturista', 'Puede ver y crear registros en todos los módulos'),
('Supervisor', 'Puede ver, crear y editar registros en todos los módulos');

-- Get template IDs and create items for each module/submodule
DO $$
DECLARE
  readonly_id uuid;
  capturista_id uuid;
  supervisor_id uuid;
  modules text[] := ARRAY['destajos', 'comisiones', 'servicios'];
  submodules_destajos text[] := ARRAY['obras', 'instaladores', 'avances', 'extras', 'solicitudes', 'cortes', 'pagos'];
  submodules_comisiones text[] := ARRAY['vendedores', 'ventas', 'pagos'];
  submodules_servicios text[] := ARRAY['tickets', 'clientes', 'proyectos', 'agenda', 'reportes'];
  m text;
  s text;
BEGIN
  SELECT id INTO readonly_id FROM public.permission_templates WHERE name = 'Solo lectura';
  SELECT id INTO capturista_id FROM public.permission_templates WHERE name = 'Capturista';
  SELECT id INTO supervisor_id FROM public.permission_templates WHERE name = 'Supervisor';

  -- Solo lectura template - only can_read = true
  FOREACH m IN ARRAY modules LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (readonly_id, m, NULL, true, false, false, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_destajos LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (readonly_id, 'destajos', s, true, false, false, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_comisiones LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (readonly_id, 'comisiones', s, true, false, false, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_servicios LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (readonly_id, 'servicios', s, true, false, false, false);
  END LOOP;

  -- Capturista template - can_read and can_create = true
  FOREACH m IN ARRAY modules LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (capturista_id, m, NULL, true, true, false, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_destajos LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (capturista_id, 'destajos', s, true, true, false, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_comisiones LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (capturista_id, 'comisiones', s, true, true, false, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_servicios LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (capturista_id, 'servicios', s, true, true, false, false);
  END LOOP;

  -- Supervisor template - can_read, can_create, can_update = true
  FOREACH m IN ARRAY modules LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (supervisor_id, m, NULL, true, true, true, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_destajos LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (supervisor_id, 'destajos', s, true, true, true, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_comisiones LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (supervisor_id, 'comisiones', s, true, true, true, false);
  END LOOP;
  
  FOREACH s IN ARRAY submodules_servicios LOOP
    INSERT INTO public.permission_template_items (template_id, module_id, submodule_id, can_read, can_create, can_update, can_delete)
    VALUES (supervisor_id, 'servicios', s, true, true, true, false);
  END LOOP;
END $$;