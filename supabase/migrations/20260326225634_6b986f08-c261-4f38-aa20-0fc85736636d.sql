
-- Cancel anticipos for closed obras: Fuente del Sol ($5,000) and TRU HOTEL AEROPUERTO ESQUINEROS ($3,480)
UPDATE public.anticipos
SET monto_disponible = 0,
    observaciones = COALESCE(observaciones || ' | ', '') || 'Cancelado: obra cerrada'
WHERE id IN (
  '8f2c1e62-2015-4ff8-9f52-a311e7f359c0',
  '15cd4c11-b39d-477e-b10a-458386a4fb21'
)
AND monto_disponible > 0;
