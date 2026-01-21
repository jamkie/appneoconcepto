-- Allow authenticated users to update obras
CREATE POLICY "Authenticated users can update obras"
ON public.obras
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete obras (trigger prevents deletion if avances exist)
CREATE POLICY "Authenticated users can delete obras"
ON public.obras
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);