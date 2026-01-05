-- Create enum for obra status (for destajos)
CREATE TYPE public.obra_status AS ENUM ('activa', 'cerrada');

-- Create enum for payment request status
CREATE TYPE public.payment_request_status AS ENUM ('pendiente', 'aprobada', 'rechazada');

-- Create enum for extra status
CREATE TYPE public.extra_status AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- Create enum for payment method
CREATE TYPE public.payment_method AS ENUM ('efectivo', 'transferencia', 'cheque', 'otro');

-- Instaladores table
CREATE TABLE public.instaladores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  numero_cuenta TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Obras table
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cliente TEXT,
  ubicacion TEXT,
  estado obra_status DEFAULT 'activa',
  precio_cocina DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_closet DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_cubierta DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_vanity DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Obra items table (partidas de obra)
CREATE TABLE public.obra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Obra-Instalador assignment table
CREATE TABLE public.obra_instaladores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  instalador_id UUID REFERENCES public.instaladores(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(obra_id, instalador_id)
);

-- Obra-Supervisor assignment table
CREATE TABLE public.obra_supervisores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  supervisor_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(obra_id, supervisor_id)
);

-- Avances table (work progress)
CREATE TABLE public.avances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  instalador_id UUID REFERENCES public.instaladores(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  cocinas_completadas INTEGER DEFAULT 0,
  closets_completados INTEGER DEFAULT 0,
  cubiertas_completadas INTEGER DEFAULT 0,
  vanitys_completados INTEGER DEFAULT 0,
  observaciones TEXT,
  registrado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Avance items table (progress on specific obra items)
CREATE TABLE public.avance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avance_id UUID REFERENCES public.avances(id) ON DELETE CASCADE NOT NULL,
  obra_item_id UUID REFERENCES public.obra_items(id) ON DELETE CASCADE NOT NULL,
  cantidad_completada INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tipos extra catalog
CREATE TABLE public.tipos_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extras table
CREATE TABLE public.extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  instalador_id UUID REFERENCES public.instaladores(id) ON DELETE CASCADE NOT NULL,
  tipo_extra_id UUID REFERENCES public.tipos_extra(id),
  descripcion TEXT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  estado extra_status DEFAULT 'pendiente',
  aprobado_por UUID,
  fecha_aprobacion TIMESTAMP WITH TIME ZONE,
  solicitado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Solicitudes pago table
CREATE TABLE public.solicitudes_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  instalador_id UUID REFERENCES public.instaladores(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL,
  cocinas_solicitadas INTEGER DEFAULT 0,
  closets_solicitados INTEGER DEFAULT 0,
  monto_libre DECIMAL(10,2) DEFAULT 0,
  extras_ids UUID[] DEFAULT '{}',
  subtotal_piezas DECIMAL(10,2) DEFAULT 0,
  subtotal_extras DECIMAL(10,2) DEFAULT 0,
  total_solicitado DECIMAL(10,2) NOT NULL,
  retencion DECIMAL(10,2) DEFAULT 0,
  estado payment_request_status DEFAULT 'pendiente',
  observaciones TEXT,
  solicitado_por UUID NOT NULL,
  aprobado_por UUID,
  fecha_aprobacion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pagos (destajos) table
CREATE TABLE public.pagos_destajos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID REFERENCES public.solicitudes_pago(id),
  instalador_id UUID REFERENCES public.instaladores(id) ON DELETE CASCADE NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  metodo_pago payment_method NOT NULL,
  referencia TEXT,
  observaciones TEXT,
  registrado_por UUID NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all destajos tables
ALTER TABLE public.instaladores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_instaladores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_supervisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_extra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_destajos ENABLE ROW LEVEL SECURITY;

-- Function to check if user can access obra
CREATE OR REPLACE FUNCTION public.can_access_obra(_obra_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.obra_supervisores
    WHERE obra_id = _obra_id AND supervisor_id = auth.uid()
  )
$$;

-- Instaladores policies
CREATE POLICY "Authenticated users can view instaladores" ON public.instaladores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert instaladores" ON public.instaladores FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update instaladores" ON public.instaladores FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete instaladores" ON public.instaladores FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Obras policies
CREATE POLICY "Admins can select obras" ON public.obras FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert obras" ON public.obras FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update obras" ON public.obras FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete obras" ON public.obras FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Supervisors can view assigned obras" ON public.obras FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.obra_supervisores WHERE obra_id = id AND supervisor_id = auth.uid())
);

-- Obra items policies
CREATE POLICY "View obra items" ON public.obra_items FOR SELECT TO authenticated USING (can_access_obra(obra_id));
CREATE POLICY "Admins insert obra items" ON public.obra_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update obra items" ON public.obra_items FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete obra items" ON public.obra_items FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Obra instaladores policies
CREATE POLICY "View obra instaladores" ON public.obra_instaladores FOR SELECT TO authenticated USING (can_access_obra(obra_id));
CREATE POLICY "Admins insert obra instaladores" ON public.obra_instaladores FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update obra instaladores" ON public.obra_instaladores FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete obra instaladores" ON public.obra_instaladores FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Obra supervisores policies
CREATE POLICY "View own assignments" ON public.obra_supervisores FOR SELECT USING (supervisor_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert assignments" ON public.obra_supervisores FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update assignments" ON public.obra_supervisores FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete assignments" ON public.obra_supervisores FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Avances policies
CREATE POLICY "View avances" ON public.avances FOR SELECT TO authenticated USING (can_access_obra(obra_id));
CREATE POLICY "Create avances" ON public.avances FOR INSERT TO authenticated WITH CHECK (can_access_obra(obra_id));
CREATE POLICY "Admins update avances" ON public.avances FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete avances" ON public.avances FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Avance items policies
CREATE POLICY "View avance items" ON public.avance_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.avances a WHERE a.id = avance_id AND can_access_obra(a.obra_id))
);
CREATE POLICY "Create avance items" ON public.avance_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.avances a WHERE a.id = avance_id AND can_access_obra(a.obra_id))
);
CREATE POLICY "Admins update avance items" ON public.avance_items FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete avance items" ON public.avance_items FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Tipos extra policies
CREATE POLICY "View tipos extra" ON public.tipos_extra FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert tipos extra" ON public.tipos_extra FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update tipos extra" ON public.tipos_extra FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete tipos extra" ON public.tipos_extra FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Extras policies
CREATE POLICY "View extras" ON public.extras FOR SELECT TO authenticated USING (can_access_obra(obra_id));
CREATE POLICY "Create extras" ON public.extras FOR INSERT TO authenticated WITH CHECK (can_access_obra(obra_id));
CREATE POLICY "Admins update extras" ON public.extras FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete extras" ON public.extras FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Solicitudes pago policies
CREATE POLICY "View solicitudes" ON public.solicitudes_pago FOR SELECT TO authenticated USING (can_access_obra(obra_id));
CREATE POLICY "Create solicitudes" ON public.solicitudes_pago FOR INSERT TO authenticated WITH CHECK (can_access_obra(obra_id));
CREATE POLICY "Admins update solicitudes" ON public.solicitudes_pago FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete solicitudes" ON public.solicitudes_pago FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Pagos destajos policies
CREATE POLICY "View pagos destajos" ON public.pagos_destajos FOR SELECT TO authenticated USING (can_access_obra(obra_id));
CREATE POLICY "Admins insert pagos destajos" ON public.pagos_destajos FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update pagos destajos" ON public.pagos_destajos FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete pagos destajos" ON public.pagos_destajos FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Add updated_at triggers
CREATE TRIGGER update_instaladores_updated_at BEFORE UPDATE ON public.instaladores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_obras_updated_at BEFORE UPDATE ON public.obras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();