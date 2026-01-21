-- Tabla para almacenar el saldo acumulado por instalador
CREATE TABLE public.saldos_instaladores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instalador_id uuid NOT NULL REFERENCES instaladores(id) ON DELETE CASCADE,
  saldo_acumulado numeric NOT NULL DEFAULT 0,
  ultimo_corte_id uuid REFERENCES cortes_semanales(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(instalador_id)
);

-- Tabla para el historial de cada instalador en cada corte cerrado
CREATE TABLE public.corte_instaladores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id uuid NOT NULL REFERENCES cortes_semanales(id) ON DELETE CASCADE,
  instalador_id uuid NOT NULL REFERENCES instaladores(id) ON DELETE CASCADE,
  destajo_acumulado numeric NOT NULL DEFAULT 0,
  salario_semanal numeric NOT NULL DEFAULT 0,
  saldo_anterior numeric NOT NULL DEFAULT 0,
  saldo_generado numeric NOT NULL DEFAULT 0,
  monto_depositado numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(corte_id, instalador_id)
);

-- Enable RLS
ALTER TABLE public.saldos_instaladores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corte_instaladores ENABLE ROW LEVEL SECURITY;

-- Policies for saldos_instaladores
CREATE POLICY "View saldos instaladores" 
ON public.saldos_instaladores 
FOR SELECT 
USING (true);

CREATE POLICY "Admins manage saldos instaladores" 
ON public.saldos_instaladores 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for corte_instaladores
CREATE POLICY "View corte instaladores" 
ON public.corte_instaladores 
FOR SELECT 
USING (true);

CREATE POLICY "Admins manage corte instaladores" 
ON public.corte_instaladores 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at on saldos_instaladores
CREATE TRIGGER update_saldos_instaladores_updated_at
BEFORE UPDATE ON public.saldos_instaladores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();