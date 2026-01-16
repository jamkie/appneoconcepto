-- Function to check if an obra should be closed automatically
CREATE OR REPLACE FUNCTION public.check_and_close_obra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
  v_monto_total numeric;
  v_total_pagado numeric;
  v_items_total integer;
  v_items_completados integer;
  v_descuento numeric;
  v_subtotal_items numeric;
  v_subtotal_extras numeric;
BEGIN
  -- Determine which obra to check based on the trigger source
  IF TG_TABLE_NAME = 'pagos_destajos' THEN
    v_obra_id := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSIF TG_TABLE_NAME = 'avance_items' THEN
    SELECT a.obra_id INTO v_obra_id
    FROM avances a
    WHERE a.id = COALESCE(NEW.avance_id, OLD.avance_id);
  ELSIF TG_TABLE_NAME = 'avances' THEN
    v_obra_id := COALESCE(NEW.obra_id, OLD.obra_id);
  END IF;

  -- Exit if no obra_id found or obra is already closed
  IF v_obra_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check if obra is already closed
  IF EXISTS (SELECT 1 FROM obras WHERE id = v_obra_id AND estado = 'cerrada') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get obra discount
  SELECT descuento INTO v_descuento FROM obras WHERE id = v_obra_id;

  -- Calculate subtotal from obra_items
  SELECT COALESCE(SUM(cantidad * precio_unitario), 0) INTO v_subtotal_items
  FROM obra_items WHERE obra_id = v_obra_id;

  -- Calculate subtotal from approved/pending extras (excluding rejected)
  SELECT COALESCE(SUM(monto), 0) INTO v_subtotal_extras
  FROM extras WHERE obra_id = v_obra_id AND estado IN ('aprobado', 'pendiente');

  -- Calculate total with discount
  v_monto_total := (v_subtotal_items + v_subtotal_extras) * (1 - COALESCE(v_descuento, 0) / 100);

  -- Calculate total paid
  SELECT COALESCE(SUM(monto), 0) INTO v_total_pagado
  FROM pagos_destajos WHERE obra_id = v_obra_id;

  -- Check if fully paid (with small tolerance for rounding)
  IF v_total_pagado < (v_monto_total - 0.01) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get total items quantity
  SELECT COALESCE(SUM(cantidad), 0) INTO v_items_total
  FROM obra_items WHERE obra_id = v_obra_id;

  -- Get completed items quantity
  SELECT COALESCE(SUM(ai.cantidad_completada), 0) INTO v_items_completados
  FROM avance_items ai
  JOIN avances a ON a.id = ai.avance_id
  WHERE a.obra_id = v_obra_id;

  -- Check if all items are installed
  IF v_items_total > 0 AND v_items_completados >= v_items_total THEN
    -- Close the obra automatically
    UPDATE obras SET estado = 'cerrada', updated_at = now() WHERE id = v_obra_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on pagos_destajos
DROP TRIGGER IF EXISTS trigger_check_obra_on_pago ON pagos_destajos;
CREATE TRIGGER trigger_check_obra_on_pago
AFTER INSERT OR UPDATE OR DELETE ON pagos_destajos
FOR EACH ROW
EXECUTE FUNCTION check_and_close_obra();

-- Create triggers on avance_items
DROP TRIGGER IF EXISTS trigger_check_obra_on_avance_item ON avance_items;
CREATE TRIGGER trigger_check_obra_on_avance_item
AFTER INSERT OR UPDATE OR DELETE ON avance_items
FOR EACH ROW
EXECUTE FUNCTION check_and_close_obra();

-- Create triggers on avances (for when avances are deleted)
DROP TRIGGER IF EXISTS trigger_check_obra_on_avance ON avances;
CREATE TRIGGER trigger_check_obra_on_avance
AFTER DELETE ON avances
FOR EACH ROW
EXECUTE FUNCTION check_and_close_obra();