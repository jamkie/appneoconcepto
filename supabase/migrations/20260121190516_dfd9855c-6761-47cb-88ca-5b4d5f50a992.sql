-- Allow authenticated users to update extras that are pending
CREATE POLICY "Authenticated users can update pending extras"
ON public.extras
FOR UPDATE
TO authenticated
USING (estado = 'pendiente')
WITH CHECK (estado = 'pendiente');

-- Allow authenticated users to delete extras that are pending
CREATE POLICY "Authenticated users can delete pending extras"
ON public.extras
FOR DELETE
TO authenticated
USING (estado = 'pendiente');