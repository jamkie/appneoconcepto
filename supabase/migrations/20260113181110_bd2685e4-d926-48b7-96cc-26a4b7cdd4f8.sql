-- Create cortes_semanales table
CREATE TABLE public.cortes_semanales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  estado text NOT NULL DEFAULT 'abierto',
  total_monto numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL,
  cerrado_por uuid,
  fecha_cierre timestamptz
);

-- Enable RLS
ALTER TABLE public.cortes_semanales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cortes_semanales
CREATE POLICY "Admins can manage cortes" ON public.cortes_semanales
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors view cortes" ON public.cortes_semanales
  FOR SELECT USING (true);

-- Add corte_id column to solicitudes_pago
ALTER TABLE public.solicitudes_pago ADD COLUMN corte_id uuid REFERENCES public.cortes_semanales(id);

-- Add corte_id column to pagos_destajos for tracking which payment belongs to which corte
ALTER TABLE public.pagos_destajos ADD COLUMN corte_id uuid REFERENCES public.cortes_semanales(id);