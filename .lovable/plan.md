
# Problema: Yenni no puede crear cortes — RLS bloquea operaciones

## Diagnóstico

Los permisos de Yenni en la base de datos son correctos para el submódulo `cortes`:
- can_read: true
- can_create: true
- can_update: true
- can_delete: true

Sin embargo, las políticas RLS (Row Level Security) de la tabla `cortes_semanales` actualmente **solo permiten a administradores** hacer INSERT, UPDATE y DELETE:

```
Policy: "Admins can manage cortes"
Command: ALL
Expression: has_role(auth.uid(), 'admin')
```

Yenni tiene rol `user`, no `admin`, por lo que la base de datos rechaza sus operaciones aunque la UI le muestre los botones activos.

Lo mismo aplica para las tablas relacionadas al proceso de cortes:
- `corte_instaladores` — solo admins pueden INSERT/UPDATE/DELETE
- `saldos_instaladores` — solo admins pueden INSERT/UPDATE/DELETE
- `solicitudes_pago` — solo admins pueden UPDATE (aprobar solicitudes al cerrar corte)
- `pagos_destajos` — solo admins pueden INSERT/UPDATE/DELETE

## Solución

Actualizar las políticas RLS de todas las tablas involucradas en el flujo de cortes para permitir que usuarios con permiso granular (`can_create`, `can_update`, `can_delete` en `user_permissions` para `destajos/cortes`) puedan ejecutar esas operaciones.

Se seguirá el mismo patrón ya usado en otras tablas del sistema (como `avances`), que verifica en `user_permissions`:

```sql
has_role(auth.uid(), 'admin') OR EXISTS (
  SELECT 1 FROM user_permissions
  WHERE user_id = auth.uid()
    AND module_id = 'destajos'
    AND submodule_id = 'cortes'
    AND can_create = true  -- o can_update / can_delete según la operación
)
```

## Tablas y políticas a actualizar

### 1. `cortes_semanales`
- INSERT: admins O usuarios con `can_create` en destajos/cortes
- UPDATE: admins O usuarios con `can_update` en destajos/cortes
- DELETE: admins O usuarios con `can_delete` en destajos/cortes

### 2. `corte_instaladores`
- INSERT/UPDATE/DELETE: admins O usuarios con permisos en destajos/cortes (estas filas se crean/actualizan al cerrar un corte)

### 3. `saldos_instaladores`
- INSERT/UPDATE: admins O usuarios con `can_update` en destajos/cortes (los saldos se actualizan al cerrar/reabrir un corte)

### 4. `pagos_destajos`
- INSERT: admins O usuarios con `can_create` en destajos/pagos (los pagos se generan al cerrar un corte)
- UPDATE: admins O usuarios con `can_update` en destajos/pagos
- DELETE: admins O usuarios con `can_delete` en destajos/pagos

### 5. `solicitudes_pago`
- UPDATE: la política actual solo permite a admins actualizar. Se necesita permitir a usuarios con `can_update` en destajos/cortes (para cambiar estado de solicitudes a 'aprobada' al cerrar el corte)

## Implementación

Se creará una única migración SQL que:
1. Elimina las políticas restrictivas existentes
2. Crea nuevas políticas que unen la comprobación de admin con la verificación de permisos granulares

No se modifica ningún código TypeScript — solo se actualizan las políticas en la base de datos.
