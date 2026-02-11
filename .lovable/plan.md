

# Plan: Restaurar Anticipos al Eliminar un Avance

## Problema

Cuando se elimina un avance que tenia un anticipo aplicado, el anticipo no vuelve a su estado disponible. Esto ocurre porque las solicitudes tipo `aplicacion_anticipo` se crean **sin vinculo directo** al avance (no tienen `avance_id`), asi que al eliminar el avance no se detectan ni revierten.

## Solucion

Dos partes: (1) vincular las solicitudes de aplicacion de anticipo al avance que las origino, y (2) al eliminar un avance, buscar y revertir esas solicitudes.

## Cambios

### 1. `src/modules/destajos/components/ApplyAnticipoModal.tsx`

- Agregar un prop opcional `avanceId?: string` a la interfaz del componente
- Al insertar la solicitud tipo `aplicacion_anticipo`, incluir `avance_id: avanceId || null` para que quede vinculada al avance que la origino

### 2. `src/modules/destajos/pages/AvancesPage.tsx`

**En la invocacion del modal (al pasar props):**
- Pasar el `avanceId` del avance recien guardado al `ApplyAnticipoModal`

**En `handleDelete` (lineas 708-769):**
Antes de eliminar las solicitudes del avance, agregar logica para:
1. Buscar solicitudes tipo `aplicacion_anticipo` vinculadas al avance (`avance_id = avanceToDelete.id`)
2. Para cada una, restaurar el `monto_disponible` del anticipo correspondiente (sumando de vuelta el `total_solicitado`)
3. Eliminar esas solicitudes de aplicacion

### 3. `src/modules/destajos/pages/SolicitudesPage.tsx`

**En `handleDeleteAvanceFromDetail` (lineas 451-495):**
Aplicar la misma logica de reversion:
1. Buscar solicitudes tipo `aplicacion_anticipo` con el `avance_id` del avance a eliminar
2. Restaurar `monto_disponible` en los anticipos correspondientes
3. Eliminar las solicitudes de aplicacion

## Seccion Tecnica

### Vincular aplicacion_anticipo al avance

En `ApplyAnticipoModal.tsx`, al insertar la solicitud:

```typescript
await supabase.from('solicitudes_pago').insert({
  tipo: 'aplicacion_anticipo',
  avance_id: avanceId || null,  // NUEVO: vincular al avance
  // ... resto de campos
});
```

### Reversion al eliminar avance

Logica a agregar en ambos handlers de eliminacion:

```typescript
// 1. Buscar aplicaciones de anticipo vinculadas a este avance
const { data: aplicaciones } = await supabase
  .from('solicitudes_pago')
  .select('id, total_solicitado, instalador_id, obra_id')
  .eq('avance_id', avanceId)
  .eq('tipo', 'aplicacion_anticipo');

// 2. Restaurar monto_disponible en cada anticipo
for (const app of aplicaciones || []) {
  const { data: anticipos } = await supabase
    .from('anticipos')
    .select('id, monto_disponible')
    .eq('instalador_id', app.instalador_id)
    .eq('obra_id', app.obra_id)
    .order('created_at', { ascending: true });

  let montoRestante = Number(app.total_solicitado);
  for (const ant of anticipos || []) {
    if (montoRestante <= 0) break;
    const restoreAmount = Math.min(montoRestante, Number(ant.monto_disponible) + montoRestante);
    await supabase
      .from('anticipos')
      .update({ monto_disponible: Number(ant.monto_disponible) + montoRestante })
      .eq('id', ant.id);
    montoRestante = 0;
  }
}

// 3. Eliminar las solicitudes de aplicacion (se eliminaran junto con las demas del avance)
```

### Nota sobre datos existentes

Las solicitudes `aplicacion_anticipo` creadas antes de este cambio no tendran `avance_id`, por lo que no se revertiran automaticamente. Esto solo afecta anticipos aplicados **a partir de ahora**.
