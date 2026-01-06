-- Add avance_id column to link solicitudes_pago with avances
ALTER TABLE public.solicitudes_pago 
ADD COLUMN avance_id uuid REFERENCES public.avances(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_solicitudes_pago_avance_id ON public.solicitudes_pago(avance_id);