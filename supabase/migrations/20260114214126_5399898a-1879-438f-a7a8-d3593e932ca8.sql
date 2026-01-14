-- Allow all authenticated users to create obras
CREATE POLICY "Authenticated users can create obras"
ON public.obras
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow all authenticated users to insert obra_items
CREATE POLICY "Authenticated users can insert obra items"
ON public.obra_items
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);