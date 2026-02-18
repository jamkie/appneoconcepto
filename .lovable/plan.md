
# Fix: Modal de Detalle de Solicitud — Agregar Scroll

## Problema

El `DialogContent` del modal de detalle de solicitud (línea 1218 en `SolicitudesPage.tsx`) no tiene límite de altura ni scroll:

```tsx
<DialogContent className="max-w-md">
  ...
  <div className="space-y-4">   // sin altura máxima ni overflow
    {/* Basic info */}
    {/* Avance items breakdown */}
    {/* Extras breakdown */}
    {/* Amounts breakdown */}
    {/* Anticipos aplicados */}
    {/* Observations */}
  </div>
```

Cuando una solicitud tiene muchos ítems de avance + anticipos aplicados, el contenido excede la altura de la pantalla y no hay manera de hacer scroll para verlo todo.

## Solución

Dos cambios en `src/modules/destajos/pages/SolicitudesPage.tsx`:

### 1. Limitar la altura del DialogContent

Agregar `max-h-[90vh]` y `flex flex-col` al `DialogContent` para que el modal no exceda el 90% del alto de la pantalla:

```tsx
<DialogContent className="max-w-md max-h-[90vh] flex flex-col">
```

### 2. Hacer scrolleable el área de contenido

Envolver el bloque de contenido del detalle en un div con `overflow-y-auto` para que sea el área interna la que haga scroll, manteniendo el header y footer fijos:

```tsx
<div className="overflow-y-auto flex-1 pr-1">
  <div className="space-y-4">
    {/* todo el contenido */}
  </div>
</div>
```

Esto sigue el patrón ya aplicado en otros modales del proyecto (como el modal de anticipos en `ApplyAnticipoModal.tsx` con `max-h: 85vh` y scroll interno).

## Archivos a modificar

- `src/modules/destajos/pages/SolicitudesPage.tsx`
  - Línea 1218: agregar `max-h-[90vh] flex flex-col` al `DialogContent`
  - Líneas 1226-1350: envolver el `div.space-y-4` en un contenedor con `overflow-y-auto flex-1`
