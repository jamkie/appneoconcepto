
# Fix: Validación de Saldo en Aprobación de Solicitudes — TRU HOTEL

## Problema Identificado

Hay dos cálculos distintos del "Total Pagado" en el sistema:

**Módulo Obras (CORRECTO):**
- Excluye pagos con `corte_id` (son distribuciones salariales ya contabilizadas en anticipos)
- Suma el `monto_original` de todos los anticipos

```
TRU HOTEL - Cálculo correcto:
  Total anticipos otorgados:  $120,000
  Pagos directos sin corte:       $0
  Total Pagado correcto:      $120,000
  Total Obra (con 10% desc):  $175,005
  Saldo pendiente real:        $55,005  ← la solicitud de $34,875 SÍ cabe
```

**Módulo Solicitudes - función `aprobarSolicitud` (INCORRECTO):**
- Suma TODOS los `pagos_destajos` sin filtrar por `corte_id`
- Incluye los 3 pagos de los cortes de Semana 7: $41,850 + $69,750 + $69,750 = **$181,350**

```
TRU HOTEL - Cálculo incorrecto en SolicitudesPage:
  Total pagado (todos):       $181,350  ← inflado por pagos de corte
  Total Obra:                 $175,005
  Saldo calculado:             -$6,345  ← NEGATIVO → bloquea la aprobación ❌
```

## Solución

Modificar la función `aprobarSolicitud` en `SolicitudesPage.tsx` para que calcule el "Total Pagado" con la misma lógica que usa el módulo de Obras:

1. **Filtrar pagos con `corte_id`**: excluirlos del cálculo, igual que hace `ObrasPage.tsx` línea 228
2. **Sumar anticipos otorgados**: usar `monto_original` de la tabla `anticipos` en lugar de pagos de corte

La misma corrección se aplicará también en `procesarAprobacionMasiva` que tiene una validación idéntica.

## Archivos a modificar

**`src/modules/destajos/pages/SolicitudesPage.tsx`**

### Cambio 1: función `aprobarSolicitud` (líneas 329-375)

Cambiar la consulta de `pagos_destajos` para:
- Agregar `.is('corte_id', null)` para excluir pagos de corte
- Agregar una consulta adicional a `anticipos` para sumar `monto_original`

```typescript
// ANTES (incorrecto):
supabase
  .from('pagos_destajos')
  .select('monto')
  .eq('obra_id', solicitud.obra_id)
// → suma $181,350

// DESPUÉS (correcto):
// Pagos directos (sin corte_id)
supabase
  .from('pagos_destajos')
  .select('monto')
  .eq('obra_id', solicitud.obra_id)
  .is('corte_id', null),
// Anticipos otorgados
supabase
  .from('anticipos')
  .select('monto_original')
  .eq('obra_id', solicitud.obra_id)
// totalPagado = pagos directos + suma monto_original anticipos → $120,000
```

### Cambio 2: función `procesarAprobacionMasiva` (líneas ~795-808)

Aplicar la misma corrección en el bloque de validación masiva.

## Resultado esperado

Con este fix:
- TRU HOTEL `totalPagado` = $120,000 (anticipos otorgados)
- `saldoPendiente` = $175,005 - $120,000 = **$55,005**
- La solicitud de $34,875 queda dentro del límite ✅
- Yenni podrá aprobar la solicitud sin bloqueo

## Sin cambios en base de datos

No se requieren cambios en la base de datos. Los datos son correctos — el problema es solo cómo el código calcula el saldo en la validación de aprobación.
