-- Add foreign key constraints to anticipos table
ALTER TABLE public.anticipos 
  ADD CONSTRAINT anticipos_instalador_id_fkey 
  FOREIGN KEY (instalador_id) REFERENCES public.instaladores(id) ON DELETE CASCADE;

ALTER TABLE public.anticipos 
  ADD CONSTRAINT anticipos_obra_id_fkey 
  FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE CASCADE;

ALTER TABLE public.anticipos 
  ADD CONSTRAINT anticipos_registrado_por_fkey 
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id);