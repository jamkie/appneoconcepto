
-- Tabla de clientes
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  contacto text,
  telefono text,
  email text,
  direccion text,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View clientes" ON public.clientes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert clientes with permission" ON public.clientes
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND module_id = 'clientes' AND can_create = true)
  );

CREATE POLICY "Update clientes with permission" ON public.clientes
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND module_id = 'clientes' AND can_update = true)
  );

CREATE POLICY "Delete clientes with permission" ON public.clientes
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND module_id = 'clientes' AND can_delete = true)
  );

-- Agregar FK opcional en pedidos
ALTER TABLE public.pedidos ADD COLUMN cliente_id uuid REFERENCES public.clientes(id);
