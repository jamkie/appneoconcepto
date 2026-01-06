-- Create anticipos table to track advance payments
CREATE TABLE public.anticipos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instalador_id UUID NOT NULL,
  obra_id UUID NOT NULL,
  monto_original NUMERIC NOT NULL,
  monto_disponible NUMERIC NOT NULL,
  observaciones TEXT,
  registrado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track which anticipos were applied to which payments
CREATE TABLE public.anticipo_aplicaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anticipo_id UUID NOT NULL REFERENCES public.anticipos(id) ON DELETE CASCADE,
  pago_id UUID NOT NULL REFERENCES public.pagos_destajos(id) ON DELETE CASCADE,
  monto_aplicado NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.anticipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipo_aplicaciones ENABLE ROW LEVEL SECURITY;

-- RLS policies for anticipos
CREATE POLICY "View anticipos" ON public.anticipos
  FOR SELECT USING (can_access_obra(obra_id));

CREATE POLICY "Create anticipos" ON public.anticipos
  FOR INSERT WITH CHECK (can_access_obra(obra_id));

CREATE POLICY "Admins update anticipos" ON public.anticipos
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete anticipos" ON public.anticipos
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for anticipo_aplicaciones
CREATE POLICY "View anticipo aplicaciones" ON public.anticipo_aplicaciones
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.anticipos a 
    WHERE a.id = anticipo_id AND can_access_obra(a.obra_id)
  ));

CREATE POLICY "Create anticipo aplicaciones" ON public.anticipo_aplicaciones
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.anticipos a 
    WHERE a.id = anticipo_id AND can_access_obra(a.obra_id)
  ));

CREATE POLICY "Admins delete anticipo aplicaciones" ON public.anticipo_aplicaciones
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));