-- Add descuento column to extras table
ALTER TABLE public.extras ADD COLUMN descuento numeric NOT NULL DEFAULT 0;