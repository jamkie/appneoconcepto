
-- Add solicitud_pago_id column to anticipos table to prevent duplicates
ALTER TABLE public.anticipos 
ADD COLUMN solicitud_pago_id UUID REFERENCES public.solicitudes_pago(id) ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate anticipos per solicitud
ALTER TABLE public.anticipos 
ADD CONSTRAINT anticipos_solicitud_pago_id_unique UNIQUE (solicitud_pago_id);

-- Create index for faster lookups
CREATE INDEX idx_anticipos_solicitud_pago_id ON public.anticipos(solicitud_pago_id);
