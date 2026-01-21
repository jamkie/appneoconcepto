-- Add created_by column to obras table to track who registered each obra
ALTER TABLE public.obras 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_obras_created_by ON public.obras(created_by);