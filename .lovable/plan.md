

# Plan: Corregir calculo de "Total Pagado" en Obras

## Problema

El calculo actual de "Total Pagado" en las obras suma los pagos de corte (pagos_destajos con `corte_id`) MAS los anticipos. Esto produce un conteo doble porque los pagos de corte son depositos salariales que ya estan representados en el sistema de anticipos.

**Ejemplo con TRU HOTEL:**
- Monto Total: $175,005
- Anticipos (monto_original): $102,500
- Pago de corte: $41,850
- Calculo actual: $102,500 + $41,850 = $144,350 (incorrecto)
- Calculo correcto: $102,500 + $0 (pagos directos) = $102,500
- Saldo correcto: $175,005 - $102,500 = **$72,505**

## Solucion

Excluir los pagos que tienen `corte_id` del calculo de "Total Pagado", ya que esos depositos ya estan representados por los anticipos del sistema de cortes. Solo se contaran pagos directos (sin `corte_id`) mas los anticipos.

## Archivos a modificar

### 1. `src/modules/destajos/pages/ObrasPage.tsx`

**Query de pagos (linea ~177-179):** Agregar `corte_id` al select para poder filtrar.

**Calculo de totalPagosSinAnticipos (lineas ~256-266):** Agregar condicion para excluir pagos con `corte_id`:

```typescript
const totalPagosSinAnticipos = (pagosData || [])
  .filter((p) => p.obra_id === obra.id)
  .filter((p) => !p.corte_id) // Excluir pagos de corte
  .filter((p) => {
    // ...filtro existente de matching anticipos...
  })
  .reduce((sum, p) => sum + Number(p.monto), 0);
```

**Lista de pagos mostrados (lineas ~226-248):** Tambien excluir pagos con `corte_id` del listado visual para no confundir al usuario.

### 2. `src/modules/destajos/pages/DestajosDashboard.tsx`

**Calculo de "Por Pagar" (lineas ~104-131):** Aplicar la misma logica - excluir pagos con `corte_id` y sumar anticipos en su lugar:

```typescript
// Agregar fetch de anticipos
const { data: anticiposData } = await supabase
  .from('anticipos')
  .select('obra_id, monto_original');

// En el calculo por obra:
const pagadoObra = pagosDirectos + anticiposObra;
```

### 3. `src/modules/destajos/hooks/useExportObrasExcel.ts`

**Calculo del Excel (lineas ~55-60):** Agregar `corte_id` al fetch de pagos y excluirlos del calculo, sumando anticipos en su lugar para mantener coherencia con la interfaz.

## Resultado esperado

- TRU HOTEL mostrara Total Pagado = $102,500 y Saldo = $72,505
- El Dashboard reflejara los mismos numeros coherentes
- El Excel exportado mantendra la misma logica de calculo

