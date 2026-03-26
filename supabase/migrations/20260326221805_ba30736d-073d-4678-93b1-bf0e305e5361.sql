
-- Delete orphaned solicitudes_pago (avance and aplicacion_anticipo) for Rafael Orozco / Fuente de Molinos
-- that have NULL avance_id (the duplicated ones from March 25)
DELETE FROM solicitudes_pago
WHERE id IN (
  'e9d0b670-ccc3-412c-9088-3cbd1d38d11d',
  'bbf617e3-40b0-43db-a3e9-98cb1278ca20',
  'f029dfe4-0d05-4f61-a156-9eb0ea2a277f',
  '7b8a26de-5480-4f36-abc4-dc7ca134bf5d',
  'd4e29ae8-e0a8-451a-a9e9-28a26f800c56',
  '14c441c0-6707-4d12-b123-82d4365867b4'
);
