-- Update function to also handle reopening obras when avances are deleted
CREATE OR REPLACE FUNCTION public.check_and_close_obra()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_obra_id uuid;
  v_monto_total numeric;
  v_total_pagado numeric;
  v_items_total integer;
  v_items_completados integer;
  v_descuento numeric;
  v_subtotal_items numeric;
  v_subtotal_extras numeric;
  v_obra_estado text;
  v_should_be_closed boolean := false;
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

  -- Exit if no obra_id found
  IF v_obra_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get current obra state and discount
  SELECT estado, descuento INTO v_obra_estado, v_descuento 
  FROM obras WHERE id = v_obra_id;

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

  -- Get total items quantity
  SELECT COALESCE(SUM(cantidad), 0) INTO v_items_total
  FROM obra_items WHERE obra_id = v_obra_id;

  -- Get completed items quantity
  SELECT COALESCE(SUM(ai.cantidad_completada), 0) INTO v_items_completados
  FROM avance_items ai
  JOIN avances a ON a.id = ai.avance_id
  WHERE a.obra_id = v_obra_id;

  -- Determine if obra should be closed
  -- Must be fully paid AND all items installed
  IF v_total_pagado >= (v_monto_total - 0.01) AND v_items_total > 0 AND v_items_completados >= v_items_total THEN
    v_should_be_closed := true;
  END IF;

  -- Update obra state if needed
  IF v_should_be_closed AND v_obra_estado = 'activa' THEN
    -- Close the obra
    UPDATE obras SET estado = 'cerrada', updated_at = now() WHERE id = v_obra_id;
  ELSIF NOT v_should_be_closed AND v_obra_estado = 'cerrada' THEN
    -- Reopen the obra (conditions no longer met)
    UPDATE obras SET estado = 'activa', updated_at = now() WHERE id = v_obra_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;