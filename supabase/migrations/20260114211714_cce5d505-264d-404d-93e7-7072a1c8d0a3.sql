-- Add bank name and weekly salary columns to instaladores table
ALTER TABLE public.instaladores
ADD COLUMN nombre_banco text,
ADD COLUMN salario_semanal numeric DEFAULT 0;