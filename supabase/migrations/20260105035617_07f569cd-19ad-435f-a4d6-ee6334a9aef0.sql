-- Create user_module_permissions table for managing module access
CREATE TABLE public.user_module_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  module_id text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
CREATE POLICY "Admins can manage module permissions"
ON public.user_module_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own permissions
CREATE POLICY "Users can view own module permissions"
ON public.user_module_permissions
FOR SELECT
USING (auth.uid() = user_id);