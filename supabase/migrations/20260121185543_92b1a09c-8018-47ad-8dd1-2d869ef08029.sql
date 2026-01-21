-- Allow authenticated users to update obra_items
CREATE POLICY "Authenticated users can update obra items"
ON public.obra_items
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete obra_items
CREATE POLICY "Authenticated users can delete obra items"
ON public.obra_items
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);