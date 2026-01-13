-- Add missing foreign key for avances.registrado_por -> profiles.id
ALTER TABLE public.avances 
ADD CONSTRAINT avances_registrado_por_fkey 
FOREIGN KEY (registrado_por) REFERENCES public.profiles(id);