
# Plan: Eliminar Diálogo de Anticipos en Aprobación Masiva

## Resumen

Eliminar el cuadro de diálogo de "Aplicar Anticipos" que aparece al aprobar solicitudes masivamente, ya que esta funcionalidad fue deshabilitada y ahora la aplicación de anticipos se hace manualmente desde el detalle del corte.

## Cambios a Realizar

### Archivo: `src/modules/destajos/pages/SolicitudesPage.tsx`

**1. Eliminar estados relacionados (líneas 83-86):**
- `showBulkAnticiposDialog`
- `bulkSolicitudesParaAprobar`
- `bulkAnticiposDisponibles`
- `bulkAnticiposSeleccionados`

**2. Simplificar `handleAprobarSeleccionadas` (líneas 700-724):**
- Eliminar la lógica que verifica si hay anticipos disponibles
- Llamar directamente a `procesarAprobacionMasiva` sin pasar por el diálogo

**3. Eliminar funciones auxiliares (líneas 864-882):**
- `handleBulkAnticipoAmountChange`
- `handleConfirmarAprobacionMasiva`
- `handleAprobarMasivoSinAnticipo`

**4. Eliminar el diálogo completo de la UI (líneas 1684-1805):**
- El componente `Dialog` que muestra los anticipos para aplicar

**5. Limpiar referencias en `procesarAprobacionMasiva` (líneas 856-860):**
- Eliminar las líneas que limpian los estados del diálogo

## Flujo Simplificado

```text
ANTES:
Usuario selecciona → Click "Aprobar" → 
  ¿Hay anticipos? → Sí → Muestra diálogo → Usuario elige → Procesa
              → No → Procesa directamente

DESPUÉS:
Usuario selecciona → Click "Aprobar" → Procesa directamente
```

## Resultado

La aprobación masiva será más directa y rápida. Los usuarios podrán aplicar anticipos manualmente desde el detalle del corte cuando lo consideren necesario, manteniendo un mejor control sobre cuándo y cuánto aplicar.
