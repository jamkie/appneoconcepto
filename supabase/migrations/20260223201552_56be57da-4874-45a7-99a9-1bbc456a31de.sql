
-- Enum para etapas de produccion
CREATE TYPE produccion_etapa AS ENUM (
  'ingenieria', 'espera_materiales', 'dimensionado',
  'enchapado', 'maquinado', 'armado', 'empaquetado', 'almacen'
);

-- Enum para estado de pedido
CREATE TYPE pedido_estado AS ENUM (
  'nuevo', 'en_ingenieria', 'en_produccion', 'completado', 'entregado'
);

-- Tabla: pedidos (creados por Ventas)
CREATE TABLE public.pedidos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente text NOT NULL,
  nombre_proyecto text NOT NULL,
  fecha_carga date NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega date,
  estado pedido_estado NOT NULL DEFAULT 'nuevo',
  creado_por uuid NOT NULL,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla: ordenes_produccion
CREATE TABLE public.ordenes_produccion (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  numero_orden text NOT NULL,
  descripcion text NOT NULL,
  etapa_actual produccion_etapa NOT NULL DEFAULT 'ingenieria',
  fecha_entrega_estimada date,
  creado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla: orden_archivos
CREATE TABLE public.orden_archivos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id uuid NOT NULL REFERENCES public.ordenes_produccion(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  tipo text NOT NULL DEFAULT 'otro',
  storage_path text NOT NULL,
  subido_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla: orden_transiciones (medicion de tiempos)
CREATE TABLE public.orden_transiciones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id uuid NOT NULL REFERENCES public.ordenes_produccion(id) ON DELETE CASCADE,
  etapa_anterior produccion_etapa NOT NULL,
  etapa_nueva produccion_etapa NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  realizado_por uuid NOT NULL,
  observaciones text
);

-- Tabla: notificaciones_produccion
CREATE TABLE public.notificaciones_produccion (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  tipo text NOT NULL DEFAULT 'general',
  leida boolean NOT NULL DEFAULT false,
  referencia_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_ordenes_pedido ON public.ordenes_produccion(pedido_id);
CREATE INDEX idx_ordenes_etapa ON public.ordenes_produccion(etapa_actual);
CREATE INDEX idx_transiciones_orden ON public.orden_transiciones(orden_id);
CREATE INDEX idx_archivos_orden ON public.orden_archivos(orden_id);
CREATE INDEX idx_notificaciones_usuario ON public.notificaciones_produccion(usuario_id, leida);
CREATE INDEX idx_pedidos_estado ON public.pedidos(estado);

-- Triggers para updated_at
CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ordenes_produccion_updated_at
  BEFORE UPDATE ON public.ordenes_produccion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =================== RLS ===================

-- pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pedidos" ON public.pedidos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert pedidos with permission" ON public.pedidos
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id = 'pedidos'
        AND can_create = true
    )
  );

CREATE POLICY "Update pedidos with permission" ON public.pedidos
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id = 'pedidos'
        AND can_update = true
    )
  );

CREATE POLICY "Delete pedidos with permission" ON public.pedidos
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id = 'pedidos'
        AND can_delete = true
    )
  );

-- ordenes_produccion
ALTER TABLE public.ordenes_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View ordenes produccion" ON public.ordenes_produccion
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert ordenes with permission" ON public.ordenes_produccion
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id = 'ordenes'
        AND can_create = true
    )
  );

CREATE POLICY "Update ordenes with permission" ON public.ordenes_produccion
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id IN ('ordenes', 'kanban')
        AND can_update = true
    )
  );

CREATE POLICY "Delete ordenes with permission" ON public.ordenes_produccion
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id = 'ordenes'
        AND can_delete = true
    )
  );

-- orden_archivos
ALTER TABLE public.orden_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View orden archivos" ON public.orden_archivos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert orden archivos with permission" ON public.orden_archivos
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id = 'ordenes'
        AND can_create = true
    )
  );

CREATE POLICY "Delete orden archivos with permission" ON public.orden_archivos
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND module_id = 'produccion'
        AND submodule_id = 'ordenes'
        AND can_delete = true
    )
  );

-- orden_transiciones
ALTER TABLE public.orden_transiciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View orden transiciones" ON public.orden_transiciones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert orden transiciones" ON public.orden_transiciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- notificaciones_produccion
ALTER TABLE public.notificaciones_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own notificaciones" ON public.notificaciones_produccion
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Insert notificaciones" ON public.notificaciones_produccion
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Update own notificaciones" ON public.notificaciones_produccion
  FOR UPDATE USING (auth.uid() = usuario_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('produccion-archivos', 'produccion-archivos', false);

CREATE POLICY "Authenticated users can view produccion files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produccion-archivos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users with permission can upload produccion files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'produccion-archivos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users with permission can delete produccion files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'produccion-archivos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM user_permissions
        WHERE user_id = auth.uid()
          AND module_id = 'produccion'
          AND submodule_id = 'ordenes'
          AND can_delete = true
      )
    )
  );

-- Enable realtime for ordenes_produccion and notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordenes_produccion;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones_produccion;
