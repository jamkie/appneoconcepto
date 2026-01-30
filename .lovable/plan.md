
# Plan: Aplicación Manual de Anticipos Disponibles

## Resumen del Cambio

Cambiar la lógica de anticipos de **automática** a **manual**:

| Antes (automático) | Después (manual) |
|---|---|
| Al cerrar el corte, el sistema descontaba automáticamente todos los anticipos disponibles | El usuario decide cuándo y cuánto descontar mediante un botón "Aplicar Anticipo" |
| Rafael Orozco: depósito reducido por $45,000 automáticamente | Rafael Orozco: recibe su anticipo de $20,000, el depósito solo se reduce por salario ($2,315.54), los $45,000 anteriores + $20,000 nuevos = $65,000 quedan disponibles para aplicar después |

## Ejemplo: Rafael Orozco - Semana 5

| Concepto | Valor |
|---|---|
| Anticipo nuevo (este corte) | $20,000 |
| Salario semanal | $2,315.54 |
| **A Depositar** | $20,000 - $2,315.54 = **$17,680** (redondeado) |
| Anticipos disponibles después del cierre | $45,000 + $20,000 = **$65,000** |

## Cambios a Implementar

### Cambio 1: Remover aplicación automática de `handleCloseCorte`

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (líneas 1374-1431)

Eliminar el bloque que aplica automáticamente los anticipos disponibles al cerrar el corte. Los anticipos solo se crean para las solicitudes tipo 'anticipo' del corte, pero no se aplican automáticamente a las deducciones.

### Cambio 2: Actualizar fórmula de cálculo

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (líneas 677-695)

Modificar la fórmula para que NO reste `anticiposAplicables` automáticamente:

```typescript
// ANTES:
const basePago = inst.destajoAcumulado - inst.salarioSemanal - inst.saldoAnterior - inst.anticiposAplicables;

// DESPUÉS:
// anticiposAplicables solo muestra lo que HAY disponible, pero NO se resta automáticamente
// Solo se resta si el usuario decide aplicarlo manualmente (creando una solicitud tipo 'aplicacion_anticipo')
const basePago = inst.destajoAcumulado - inst.salarioSemanal - inst.saldoAnterior - inst.anticiposAplicadosManualmente;
```

### Cambio 3: Agregar nuevo campo `anticiposAplicadosManualmente`

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (líneas 54-69)

```typescript
interface InstaladorResumen {
  // ...
  anticiposEnCorte: number;           // Anticipos OTORGADOS en este corte
  anticiposDisponibles: number;       // Anticipos disponibles (solo informativo)
  anticiposAplicadosManualmente: number; // Anticipos que el usuario decidió aplicar
  // ...
}
```

### Cambio 4: Crear función `handleApplyAnticipoToCorte`

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (después de `handleApplySaldoToCorte`)

Similar a `handleApplySaldoToCorte`, esta función:
1. Abre un modal para seleccionar el monto a descontar (de los anticipos disponibles)
2. Crea una solicitud tipo `'aplicacion_anticipo'` asignada al corte abierto
3. Reduce el `monto_disponible` del anticipo correspondiente
4. Registra en `anticipo_aplicaciones` para trazabilidad

### Cambio 5: Agregar Modal de Aplicación de Anticipo

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (nuevo estado y modal)

Nuevo modal que muestra:
- Lista de anticipos disponibles del instalador (con fecha y monto)
- Campo para ingresar monto a aplicar (o checkbox por anticipo)
- Botón "Aplicar" que ejecuta `handleApplyAnticipoToCorte`

### Cambio 6: Agregar botón "Aplicar Anticipo" en UI del resumen

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (líneas 2674-2678)

Cambiar la columna de "-Aplicados" para que:
- Muestre el monto disponible (informativo)
- Incluya un botón "Aplicar" que abre el modal
- Solo visible cuando el corte está abierto

```
| Instalador   | Destajo | +Anticipo | Salario | -Descuento | Disponibles     | A Depositar |
|--------------|---------|-----------|---------|------------|-----------------|-------------|
| Rafael Orozco| -       | $20,000   | $2,315  | -          | $45,000 [Aplicar] | $17,680   |
```

### Cambio 7: Actualizar lógica al cerrar el corte

Cuando se cierre el corte:
- Los anticipos disponibles que el usuario aplicó manualmente ya están registrados como solicitudes
- Solo se generan los nuevos anticipos (de solicitudes tipo 'anticipo')
- NO se aplican automáticamente los que no fueron seleccionados

### Cambio 8: Actualizar Excel de exportación

**Ubicación**: `src/modules/destajos/hooks/useExportCorteExcel.ts`

- Columna `+ANTICIPOS`: Anticipos otorgados en este corte
- Columna `-APLICADOS`: Solo lo que el usuario decidió aplicar manualmente
- No mostrar el total disponible que no fue aplicado

## Flujo Correcto con Aplicación Manual

```text
CORTE ABIERTO
    │
    ├─► Instalador tiene anticipos disponibles de cortes anteriores
    │     └─► Se muestra "$45,000 disponibles" con botón [Aplicar]
    │
    ├─► Usuario agrega solicitud tipo 'anticipo' de $20,000
    │     └─► Se muestra en columna "+Anticipo"
    │
    └─► Usuario decide NO aplicar los $45,000 anteriores
          └─► Columna "-Aplicados" queda en $0

CERRAR CORTE
    │
    ├─► Se calcula: $20,000 (anticipo nuevo) - $2,315.54 (salario) = $17,680
    ├─► Se genera pago por $17,680 (o el anticipo completo según reglas)
    ├─► Se crea registro en 'anticipos' para el nuevo anticipo de $20,000
    │
    └─► Los $45,000 anteriores siguen disponibles (monto_disponible sin cambios)
          └─► Total disponible después: $45,000 + $20,000 = $65,000
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/modules/destajos/pages/CortesPage.tsx` | Interfaz, estado, función `handleApplyAnticipoToCorte`, modal, UI, remover aplicación automática |
| `src/modules/destajos/hooks/useExportCorteExcel.ts` | Actualizar columna "-APLICADOS" para reflejar solo aplicaciones manuales |

## Detalles Técnicos

### Nuevo tipo de solicitud: `aplicacion_anticipo`

Similar a `saldo`, este tipo de solicitud representa una deducción manual de anticipos:

```typescript
{
  tipo: 'aplicacion_anticipo',
  instalador_id: '...',
  obra_id: '...',                // Tomada del anticipo
  total_solicitado: montoAAplicar,
  estado: 'aprobada',
  corte_id: corteAbierto.id,
  observaciones: 'Aplicación manual de anticipo'
}
```

### Registro de la aplicación

Al aplicar manualmente, también se registra en `anticipo_aplicaciones`:
- `anticipo_id`: ID del anticipo que se está aplicando
- `pago_id`: Se genera al cerrar el corte (o null si se registra antes)
- `monto_aplicado`: Monto que el usuario decidió aplicar

### Restauración al reabrir/eliminar corte

Si se reabre el corte, las solicitudes tipo `aplicacion_anticipo` se revierten:
- Se restaura el `monto_disponible` del anticipo
- Se elimina el registro de `anticipo_aplicaciones`
- Se elimina la solicitud

## Resultado Esperado

1. **Rafael Orozco - Semana 5**:
   - Recibe anticipo de $20,000
   - Se descuenta salario de $2,315.54
   - **Depósito: $17,680**
   - Anticipos pendientes por aplicar: $65,000

2. **UI del Corte**:
   - Columna "Disponibles" muestra $45,000 con botón [Aplicar]
   - Columna "+Anticipo" muestra $20,000 (nuevo)
   - Columna "-Aplicados" muestra $0 (nada aplicado manualmente)

3. **Flexibilidad**:
   - El usuario puede decidir aplicar parcialmente ($10,000 de los $45,000)
   - O no aplicar nada y dejar todo pendiente
