

# Plan: Corregir Lógica de Anticipos en Cortes Semanales

## Resumen del Problema

Actualmente hay múltiples fallos en la lógica de anticipos:

1. **Los anticipos NUNCA se aplican automáticamente** - El código busca anticipos disponibles de **otros cortes anteriores** para aplicarlos al cierre, pero la lógica solo ejecuta la aplicación si el instalador tiene solicitudes de trabajo en este corte.

2. **Los anticipos del mismo corte se marcan como disponibles inmediatamente** - Cuando se cierra un corte que contiene solicitudes tipo "anticipo", esos anticipos se crean con `monto_disponible = monto_original`. Según tus reglas, estos NO deben estar disponibles para aplicarse hasta que el corte esté cerrado.

3. **La aplicación de anticipos no respeta el tope de $0** - El código actual aplica todo el anticipo sin verificar si el depósito resultante sería negativo.

4. **Al reabrir un corte, los anticipos generados en ese mismo cierre deberían eliminarse** - Actualmente solo se restauran los anticipos aplicados, pero los "nuevos" generados por ese cierre no se eliminan.

## Flujo Correcto (según tus respuestas)

```text
CREAR SOLICITUD TIPO ANTICIPO
       │
       ▼
APROBAR → Estado "aprobada", NO se crea registro en 'anticipos'
       │
       ▼
CERRAR CORTE
       │
       ├─► Para solicitudes tipo 'anticipo': 
       │     → AHORA se crea registro en 'anticipos' con monto_disponible = monto_original
       │     → Se genera pago por ese monto (es dinero que se entrega)
       │
       └─► Para instaladores con trabajo (destajo > 0):
             → Buscar anticipos disponibles de CORTES ANTERIORES
             → Aplicar hasta que el depósito quede en $0 (no más)
             → Registrar en 'anticipo_aplicaciones'
             → Reducir 'monto_disponible' del anticipo

REABRIR CORTE
       │
       ├─► Restaurar anticipos aplicados (usando anticipo_aplicaciones)
       │
       └─► ELIMINAR anticipos generados por las solicitudes de este corte
```

## Problemas Específicos en el Código Actual

### Problema 1: Anticipos del mismo corte se crean antes de tiempo
**Ubicación**: `handleApproveAndAddToCorte` (líneas 758-781)  
**Problema**: Cuando se aprueba una solicitud tipo "anticipo" desde el detalle del corte, se crea inmediatamente el registro en `anticipos`

### Problema 2: Aplicación de anticipos disponibles no funciona correctamente
**Ubicación**: `handleCloseCorte` (líneas 1377-1437)  
**Problema**: 
- Solo se ejecuta si `instSolicitudes.length > 0` (solicitudes tipo trabajo)
- Un instalador que solo tiene anticipos nuevos no tiene pagos creados, entonces nunca aplica anticipos previos
- No verifica el tope de $0 antes de aplicar

### Problema 3: Al reabrir no se eliminan los anticipos generados
**Ubicación**: `handleReopenCorte` (líneas 1541-1742)  
**Problema**: Falta eliminar los registros de `anticipos` vinculados a solicitudes tipo anticipo del corte

## Solución Propuesta

### Cambio 1: No crear anticipo al aprobar desde corte abierto
Modificar `handleApproveAndAddToCorte` para que NO cree el anticipo al aprobar una solicitud tipo "anticipo". Solo marcar la solicitud como aprobada.

### Cambio 2: Crear anticipos solo al cerrar el corte
Mover la creación de registros en `anticipos` (para solicitudes tipo anticipo) al momento de `handleCloseCorte`, justo después de crear los pagos.

### Cambio 3: Aplicar anticipos disponibles respetando tope $0
Modificar la lógica de aplicación de anticipos:
- Ejecutar para TODOS los instaladores que tienen destajo (no solo los que tienen solicitudes de trabajo)
- Calcular primero cuánto se puede aplicar sin que el depósito quede negativo
- Aplicar solo hasta ese monto
- Si sobra anticipo, mantenerlo disponible para futuros cortes

### Cambio 4: Eliminar anticipos generados al reabrir
En `handleReopenCorte`, agregar lógica para:
- Identificar solicitudes tipo "anticipo" en este corte
- Eliminar los registros de `anticipos` vinculados vía `solicitud_pago_id`

### Cambio 5: Eliminar anticipos al cancelar solicitud aprobada (disponibles tab)
Asegurarse de que `handleCancelSolicitudAprobada` elimine el anticipo si existe (ya está implementado pero confirmar)

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/modules/destajos/pages/CortesPage.tsx` | Modificar `handleApproveAndAddToCorte`, `handleCloseCorte`, `handleReopenCorte` |

## Detalles Técnicos

### handleApproveAndAddToCorte - Remover creación de anticipo
```typescript
// REMOVER este bloque (líneas 758-781):
// if (solicitud.tipo === 'anticipo') { ... }
```

### handleCloseCorte - Crear anticipos al cerrar
Después de procesar todos los pagos, crear los registros de anticipos:
```typescript
// Para cada solicitud tipo 'anticipo' incluida en este corte:
// 1. Crear pago por el monto del anticipo (ya se hace)
// 2. Crear registro en 'anticipos' con monto_disponible = monto_original
```

### handleCloseCorte - Aplicar anticipos con tope $0
```typescript
// Antes de aplicar anticipos, calcular:
const maxAplicable = Math.max(0, inst.aDepositar); // Tope: no bajar de 0

// Aplicar anticipos hasta maxAplicable
let totalAplicado = 0;
for (const anticipo of anticiposDisponibles) {
  if (totalAplicado >= maxAplicable) break;
  const montoAplicar = Math.min(anticipo.monto_disponible, maxAplicable - totalAplicado);
  // ... registrar aplicación
  totalAplicado += montoAplicar;
}
```

### handleReopenCorte - Eliminar anticipos del corte
```typescript
// Identificar solicitudes tipo 'anticipo' en este corte
const anticipoSolicitudes = solicitudesData.filter(s => s.tipo === 'anticipo');
if (anticipoSolicitudes.length > 0) {
  const solicitudIds = anticipoSolicitudes.map(s => s.id);
  await supabase
    .from('anticipos')
    .delete()
    .in('solicitud_pago_id', solicitudIds);
}
```

## Resultado Esperado

1. **Anticipos nuevos** (solicitudes tipo anticipo): Se vuelven disponibles SOLO después de cerrar el corte
2. **Anticipos disponibles** (de cortes anteriores): Se aplican automáticamente al cerrar, respetando el tope de $0
3. **Reabrir corte**: Restaura anticipos aplicados Y elimina anticipos generados en ese cierre
4. **Eliminar corte**: Igual que reabrir + revertir todo a pendiente

