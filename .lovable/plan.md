

# Plan: Restaurar Anticipos de Angel Uriel Flores Lara

## Resumen

Los dos anticipos de **Angel Uriel Flores Lara** fueron incorrectamente reducidos a $0 por la lógica anterior (que restaba al aprobar en lugar de al cerrar el corte). Dado que no existe registro en `anticipo_aplicaciones`, la función de reapertura no pudo restaurarlos automáticamente.

## Anticipos a Restaurar

| Obra | Monto Original | Estado Actual | Estado Correcto |
|------|----------------|---------------|-----------------|
| COSTAVENTURA 1401 | $4,000 | $0 disponible | $4,000 disponible |
| BAYAM 1306 | $3,000 | $0 disponible | $3,000 disponible |

## Acción Requerida

Ejecutar una actualización directa en la base de datos para restaurar el `monto_disponible` al valor original:

```sql
UPDATE anticipos 
SET monto_disponible = monto_original
WHERE id IN (
  'f5d078d7-f7de-48f5-bba5-da6370d5d455',  -- COSTAVENTURA 1401 - $4,000
  '1662b129-18a5-47a9-858a-7610a615f9b3'   -- BAYAM 1306 - $3,000
)
```

## Resultado Esperado

Después de la corrección:
- Ambos anticipos aparecerán en la sección "Anticipos Disponibles" en Solicitudes y Cortes
- El total disponible de Angel Uriel será $7,000
- Podrán aplicarse correctamente en futuros cierres de corte

