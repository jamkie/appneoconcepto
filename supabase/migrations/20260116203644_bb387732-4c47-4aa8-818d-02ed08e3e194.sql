-- Function to prevent deleting obras with avances
CREATE OR REPLACE FUNCTION public.prevent_obra_deletion_with_avances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM avances WHERE obra_id = OLD.id) THEN
    RAISE EXCEPTION 'No se puede eliminar una obra que tiene avances registrados';
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger on obras
DROP TRIGGER IF EXISTS trigger_prevent_obra_deletion ON obras;
CREATE TRIGGER trigger_prevent_obra_deletion
BEFORE DELETE ON obras
FOR EACH ROW
EXECUTE FUNCTION prevent_obra_deletion_with_avances();