

# Plan: Corregir Aplicación de Anticipos Disponibles en Cortes

## Resumen del Problema

Cuando cierras un corte, los anticipos disponibles de cortes anteriores **no se están descontando del pago**. En el ejemplo de Angel Uriel:

| Concepto | Valor |
|----------|-------|
| Destajo Semana 5 | $21,100 |
| Anticipos disponibles (de Semana 4) | $7,000 (3,000 + 4,000) |
| Salario semanal | ~$6,946 |
| **Lo esperado a depositar** | ~$14,100 - salario |
| **Lo que pasa actualmente** | $21,100 - salario = ~$14,150 |

El sistema **no está considerando** los $7,000 de anticipos disponibles para descontarlos.

## Causa Raíz

El código tiene **dos conceptos de anticipos** pero solo implementa uno:

1. **`anticiposEnCorte`**: Anticipos que se están **otorgando** en este corte (solicitudes tipo 'anticipo'). **Esto funciona correctamente**.

2. **`anticiposDisponibles`**: Anticipos de cortes **anteriores** que tienen saldo pendiente de cobro. **Esto NO está implementado**.

El campo `anticiposEnCorte` actualmente solo cuenta los anticipos NUEVOS del corte, pero los anticipos de cortes anteriores (que deben descontarse) **nunca se cargan ni se muestran**.

## Solución Propuesta

### Cambio 1: Agregar campo `anticiposAplicables` al tipo `InstaladorResumen`
Nuevo campo para trackear cuánto de anticipos disponibles se aplicarán a este instalador.

### Cambio 2: Cargar anticipos disponibles en `handleViewCorte`
Al cargar los detalles del corte, consultar la tabla `anticipos` para obtener el monto disponible por instalador (solo de cortes anteriores).

### Cambio 3: Actualizar la fórmula de cálculo
Modificar el cálculo de `basePago` para incluir los anticipos aplicables:
```
basePago = Destajo - Salario - SaldoAnterior - AnticiposAplicables
```

### Cambio 4: Mostrar dos columnas en la UI
Según tu preferencia:
- **"Anticipos otorgados"**: Dinero nuevo que se le da al instalador (sumado al destajo para fines de pago)
- **"Anticipos aplicados"**: Descuento de anticipos previos (resta del depósito)

### Cambio 5: Ordenar aplicación por antigüedad
Los anticipos más viejos se aplican primero.

### Cambio 6: Corregir `handleCloseCorte`
Asegurar que la aplicación de anticipos:
- Se ejecute para todos los instaladores con destajo (no solo los que tienen solicitudes de trabajo)
- Calcule el `maxAplicable` **después** de restar el salario y saldo, pero **antes** de restar anticipos
- Ordene por fecha de creación (más viejos primero)

### Cambio 7: Actualizar el Excel de exportación
Agregar columna de "Anticipos Aplicados" (descuentos) además de "Anticipos" (otorgados).

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/modules/destajos/pages/CortesPage.tsx` | Tipo, fetch, cálculo, UI, cierre |
| `src/modules/destajos/hooks/useExportCorteExcel.ts` | Nueva columna de anticipos aplicados |

## Detalles Técnicos

### Nuevo campo en InstaladorResumen (líneas 54-68)
```typescript
interface InstaladorResumen {
  // ... campos existentes ...
  anticiposEnCorte: number;      // Anticipos otorgados en este corte (dinero que sale)
  anticiposAplicables: number;   // Anticipos de cortes anteriores a descontar
  // ...
}
```

### Consulta de anticipos disponibles en handleViewCorte
```typescript
// Fetch anticipos disponibles por instalador (de cortes anteriores)
const { data: anticiposData } = await supabase
  .from('anticipos')
  .select('instalador_id, monto_disponible, created_at, solicitud_pago_id')
  .gt('monto_disponible', 0)
  .order('created_at', { ascending: true }); // Más viejos primero

// Excluir anticipos de solicitudes del corte actual
const solicitudIdsEnCorte = new Set((asignadas || []).map(s => s.id));
const anticiposByInstalador: Record<string, number> = {};

anticiposData?.forEach(a => {
  if (!a.solicitud_pago_id || !solicitudIdsEnCorte.has(a.solicitud_pago_id)) {
    anticiposByInstalador[a.instalador_id] = 
      (anticiposByInstalador[a.instalador_id] || 0) + Number(a.monto_disponible);
  }
});
```

### Nueva fórmula de cálculo
```typescript
// Para cortes abiertos:
const basePago = 
  inst.destajoAcumulado - 
  inst.salarioSemanal - 
  inst.saldoAnterior - 
  inst.anticiposAplicables; // <-- Nuevo: descuento de anticipos previos

// Nota: anticiposEnCorte NO se resta del basePago porque son pagos adicionales
// que salen hacia el instalador (como el salario), no descuentos.
```

### UI con dos columnas (línea ~2540-2720)
```
| Instalador | Destajo | +Anticipo | Salario | -Descuento | -Aplicados | A Depositar |
|------------|---------|-----------|---------|------------|------------|-------------|
| Angel Uriel| $21,100 | -         | $6,946  | -          | -$7,000    | ~$7,150     |
```

- **+Anticipo**: Dinero que se le entrega (solicitudes tipo 'anticipo' de este corte)
- **-Aplicados**: Descuento de anticipos previos disponibles

### Verificación del ejemplo de Angel Uriel
Con la corrección:
- Destajo: $21,100
- Salario: ~$6,946
- Anticipos aplicables: $7,000
- basePago = 21,100 - 6,946 - 7,000 = **$7,154**
- A Depositar (redondeado): **$7,150**

## Flujo Correcto

```text
CARGAR CORTE (handleViewCorte)
       │
       ├─► Fetch solicitudes del corte
       ├─► Fetch anticipos disponibles (monto_disponible > 0)
       │     └─► Excluir anticipos de solicitudes del corte actual
       │
       └─► Por cada instalador:
             ├─► anticiposEnCorte = suma de solicitudes tipo 'anticipo' del corte
             └─► anticiposAplicables = suma de anticipos disponibles (de cortes anteriores)

CALCULAR DEPÓSITO
       │
       └─► basePago = Destajo - Salario - Saldo - AnticiposAplicables
             └─► Redondear a múltiplos de 50

CERRAR CORTE
       │
       └─► Aplicar anticipos disponibles a pagos
             ├─► Ordenar por created_at (más viejos primero)
             ├─► maxAplicable = MAX(0, basePagoSinAnticipos)
             └─► Registrar en anticipo_aplicaciones
```

## Resultado Esperado

1. **En la UI**: Ver dos columnas separadas - anticipos otorgados y anticipos aplicados
2. **En el cierre**: Los $7,000 de Angel Uriel se descontarán automáticamente
3. **En el Excel**: Columnas claras mostrando ambos conceptos
4. **En la reapertura**: Los anticipos aplicados se restauran correctamente (ya funciona)

