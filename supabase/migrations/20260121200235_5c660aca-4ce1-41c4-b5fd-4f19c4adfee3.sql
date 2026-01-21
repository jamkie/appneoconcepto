-- Create table for tracking installer percentages per avance
CREATE TABLE public.avance_instaladores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  avance_id UUID NOT NULL REFERENCES public.avances(id) ON DELETE CASCADE,
  instalador_id UUID NOT NULL REFERENCES public.instaladores(id),
  porcentaje NUMERIC NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(avance_id, instalador_id)
);

-- Make instalador_id nullable in avances for multi-installer avances
ALTER TABLE public.avances ALTER COLUMN instalador_id DROP NOT NULL;

-- Enable RLS
ALTER TABLE public.avance_instaladores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for avance_instaladores
CREATE POLICY "View avance instaladores"
ON public.avance_instaladores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM avances a
    WHERE a.id = avance_instaladores.avance_id
    AND can_access_obra(a.obra_id)
  )
);

CREATE POLICY "Create avance instaladores"
ON public.avance_instaladores
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM avances a
    WHERE a.id = avance_instaladores.avance_id
    AND can_access_obra(a.obra_id)
  )
);

CREATE POLICY "Admins update avance instaladores"
ON public.avance_instaladores
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Delete avance instaladores with permissions"
ON public.avance_instaladores
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid()
    AND user_permissions.module_id = 'destajos'
    AND user_permissions.submodule_id = 'avances'
    AND user_permissions.can_delete = true
  )
);

-- Add index for performance
CREATE INDEX idx_avance_instaladores_avance_id ON public.avance_instaladores(avance_id);
CREATE INDEX idx_avance_instaladores_instalador_id ON public.avance_instaladores(instalador_id);