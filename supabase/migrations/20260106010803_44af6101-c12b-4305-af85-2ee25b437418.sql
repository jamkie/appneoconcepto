-- Add active status column to profiles
ALTER TABLE public.profiles ADD COLUMN activo boolean NOT NULL DEFAULT true;

-- Create index for filtering
CREATE INDEX idx_profiles_activo ON public.profiles(activo);