-- Add discount percentage column to obras table
ALTER TABLE public.obras 
ADD COLUMN descuento numeric NOT NULL DEFAULT 0;