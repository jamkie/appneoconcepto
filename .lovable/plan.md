

# Plan: Corregir Restauración de Anticipos en Reapertura y Eliminación de Cortes

## Problema Identificado

Cuando aplicas manualmente un anticipo en el modal:
1. Se crea una solicitud tipo `aplicacion_anticipo` asignada al corte
2. Se **reduce** el `monto_disponible` del anticipo correspondiente

Pero cuando **reabres** o **eliminas** el corte:
- El código **NO identifica** las solicitudes tipo `aplicacion_anticipo`
- Por lo tanto, **NO restaura** el `monto_disponible` a los anticipos afectados
- Resultado: Los anticipos "desaparecen" (su saldo se pierde)

## Ejemplo del Bug

| Acción | monto_disponible de Rafael |
|--------|---------------------------|
| Antes de aplicar | $45,000 |
| Aplicas $20,000 manualmente | $25,000 (correcto) |
| **Reabres el corte** | $25,000 ❌ (debería restaurar a $45,000) |

## Solución

Agregar lógica en `handleReopenCorte` y `handleDeleteCorte` para:
1. Identificar solicitudes tipo `aplicacion_anticipo` del corte
2. Para cada una, buscar el anticipo relacionado (por `obra_id` + `instalador_id`)
3. Restaurar el `monto_disponible` sumando el `total_solicitado` de la solicitud
4. Eliminar la solicitud `aplicacion_anticipo`

## Cambios a Implementar

### Cambio 1: Agregar restauración de anticipos manuales en `handleReopenCorte`

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (después de línea 1600, antes de eliminar corte_instaladores)

```typescript
// CRITICAL: Restore anticipos from 'aplicacion_anticipo' solicitudes
// When manually applying anticipos, the monto_disponible was reduced
// We need to restore it when reopening the corte
const aplicacionAnticipoSolicitudes = (solicitudesData || []).filter(s => s.tipo === 'aplicacion_anticipo');

for (const sol of aplicacionAnticipoSolicitudes) {
  // Find the anticipo to restore based on obra_id and instalador_id
  // Since we might have multiple anticipos per instalador/obra, we need to find ones with partial availability
  const { data: anticipos } = await supabase
    .from('anticipos')
    .select('id, monto_disponible, monto_original')
    .eq('instalador_id', sol.instalador_id)
    .eq('obra_id', sol.obra_id)
    .order('created_at', { ascending: true }); // FIFO
  
  if (anticipos && anticipos.length > 0) {
    let montoToRestore = Number(sol.total_solicitado);
    
    // Restore to anticipos, starting with oldest (FIFO restore)
    for (const anticipo of anticipos) {
      if (montoToRestore <= 0) break;
      
      const currentDisponible = Number(anticipo.monto_disponible);
      const maxToRestore = Number(anticipo.monto_original) - currentDisponible;
      const restoreAmount = Math.min(montoToRestore, maxToRestore);
      
      if (restoreAmount > 0) {
        await supabase
          .from('anticipos')
          .update({ monto_disponible: currentDisponible + restoreAmount })
          .eq('id', anticipo.id);
        
        montoToRestore -= restoreAmount;
      }
    }
  }
  
  // Delete the aplicacion_anticipo solicitud
  await supabase
    .from('solicitudes_pago')
    .delete()
    .eq('id', sol.id);
}
```

### Cambio 2: Agregar restauración de anticipos manuales en `handleDeleteCorte`

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (después de línea 1777, antes de revertir extras)

Mismo patrón que arriba - identificar solicitudes `aplicacion_anticipo` y restaurar los anticipos.

### Cambio 3: También manejar en `handleRemoveSolicitudFromCorte`

**Ubicación**: `src/modules/destajos/pages/CortesPage.tsx` (función `removeSolicitudFromCorteInternal`)

Cuando se remueve UNA solicitud del corte, si es tipo `aplicacion_anticipo`, restaurar el anticipo correspondiente.

## Flujo Corregido

```text
APLICAR ANTICIPO MANUALMENTE
    │
    ├─► Crea solicitud tipo 'aplicacion_anticipo' (monto: $20,000)
    └─► Reduce anticipo.monto_disponible de $45,000 a $25,000

REABRIR/ELIMINAR CORTE
    │
    ├─► Identifica solicitudes 'aplicacion_anticipo' del corte
    ├─► Para cada una:
    │     ├─► Busca anticipos del instalador/obra
    │     ├─► Restaura monto_disponible (hasta monto_original)
    │     └─► Elimina la solicitud 'aplicacion_anticipo'
    │
    └─► anticipo.monto_disponible restaurado a $45,000 ✅

REMOVER SOLICITUD INDIVIDUAL
    │
    └─► Si es 'aplicacion_anticipo':
          ├─► Restaura monto_disponible del anticipo
          └─► Elimina la solicitud
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/modules/destajos/pages/CortesPage.tsx` | `handleReopenCorte`, `handleDeleteCorte`, `removeSolicitudFromCorteInternal` |

## Resultado Esperado

1. **Reabrir corte**: Los anticipos que fueron aplicados manualmente se restauran
2. **Eliminar corte**: Igual, los anticipos se restauran completamente
3. **Remover solicitud individual**: Si remueves una solicitud `aplicacion_anticipo`, el anticipo se restaura

## Consideración Adicional

Dado que el modal de aplicación no guarda un `anticipo_id` directamente en la solicitud (solo guarda `obra_id` e `instalador_id`), la restauración busca anticipos por esos criterios. Esto debería funcionar correctamente para el caso de uso actual.

En el futuro, podría ser útil agregar un campo `anticipo_id` a las solicitudes tipo `aplicacion_anticipo` para un mapeo más preciso. Pero por ahora, el método por `obra_id` + `instalador_id` con orden FIFO debería ser suficiente.

