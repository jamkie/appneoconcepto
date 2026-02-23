
# Modulo de Produccion - Plan de Implementacion

Este es un modulo grande que se debe construir por fases. A continuacion se presenta la Fase 1 que incluye la estructura base, las tablas de base de datos, y las vistas principales funcionales.

---

## Fase 1: Estructura Base y Vistas Principales

### 1. Base de Datos - Nuevas Tablas

Se crearan las siguientes tablas con sus RLS policies:

**`pedidos`** - Pedidos creados por Ventas
- `id` (uuid, PK)
- `cliente` (text)
- `nombre_proyecto` (text)
- `fecha_carga` (date, default CURRENT_DATE)
- `fecha_entrega` (date, nullable)
- `estado` (text: 'nuevo', 'en_ingenieria', 'en_produccion', 'completado', 'entregado')
- `creado_por` (uuid, ref profiles)
- `observaciones` (text, nullable)
- `created_at`, `updated_at`

**`ordenes_produccion`** - Ordenes que avanzan por el flujo
- `id` (uuid, PK)
- `pedido_id` (uuid, FK a pedidos)
- `numero_orden` (text, generado)
- `descripcion` (text)
- `etapa_actual` (text: 'ingenieria', 'espera_materiales', 'dimensionado', 'enchapado', 'maquinado', 'armado', 'empaquetado', 'almacen')
- `fecha_entrega_estimada` (date, nullable)
- `creado_por` (uuid)
- `created_at`, `updated_at`

**`orden_archivos`** - Archivos adjuntos por orden
- `id` (uuid, PK)
- `orden_id` (uuid, FK a ordenes_produccion)
- `nombre_archivo` (text)
- `tipo` (text: 'plano', 'despiece', 'orden_compra', 'otro')
- `storage_path` (text)
- `subido_por` (uuid)
- `created_at`

**`orden_transiciones`** - Historial de cambios de etapa (medicion de tiempos)
- `id` (uuid, PK)
- `orden_id` (uuid, FK)
- `etapa_anterior` (text)
- `etapa_nueva` (text)
- `timestamp` (timestamptz, default now())
- `realizado_por` (uuid)
- `observaciones` (text, nullable)

**`notificaciones_produccion`** - Sistema de notificaciones in-app
- `id` (uuid, PK)
- `usuario_id` (uuid, ref profiles)
- `titulo` (text)
- `mensaje` (text)
- `tipo` (text: 'material_recibido', 'orden_nueva', 'orden_completada', 'general')
- `leida` (boolean, default false)
- `referencia_id` (uuid, nullable) -- ID de la orden/pedido relacionado
- `created_at`

Ademas se creara un **storage bucket** `produccion-archivos` para los PDFs/Excel.

### 2. RLS Policies

Todas las tablas tendran:
- SELECT: Todos los usuarios autenticados (lectura abierta dentro del modulo)
- INSERT/UPDATE/DELETE: Basado en `user_permissions` con module_id='produccion' y submodule_id correspondiente, o admin

### 3. Registro del Modulo

**`src/data/modules.ts`** - Actualizar el modulo 'produccion' de `coming_soon` a `active` con submodulos:
- dashboard, pedidos, ordenes, kanban, calendario, notificaciones

**`src/App.tsx`** - Agregar ruta `/produccion/*`

### 4. Estructura de Archivos

```text
src/modules/produccion/
  index.ts
  types/index.ts
  components/
    ProduccionLayout.tsx      -- Sidebar/nav siguiendo patron de DestajosLayout
    StatCard.tsx              -- Reutilizable
    StatusBadge.tsx
    KanbanBoard.tsx           -- Tablero Kanban con drag (touch-optimized)
    KanbanColumn.tsx
    KanbanCard.tsx
    OrdenDetailSheet.tsx      -- Sheet/drawer para ver detalle de orden
    FileUploader.tsx          -- Subida de archivos
    NotificationBell.tsx      -- Campanita de notificaciones
    CalendarView.tsx          -- Calendario de entregas
  pages/
    ProduccionPage.tsx        -- Router principal (como DestajosPage)
    ProduccionDashboard.tsx   -- Metricas generales
    PedidosPage.tsx           -- CRUD de pedidos (rol Ventas)
    OrdenesPage.tsx           -- Lista/gestion de ordenes (rol Ingenieria)
    KanbanPage.tsx            -- Vista Kanban (rol Produccion)
    CalendarioPage.tsx        -- Calendario de entregas
    NotificacionesPage.tsx    -- Lista de notificaciones
  hooks/
    useOrdenes.ts
    usePedidos.ts
    useNotificaciones.ts
    useKanbanDrag.ts
```

### 5. Vistas Principales

**Dashboard de Produccion**
- Stat cards: Pedidos activos, Ordenes en proceso, Ordenes completadas hoy, Ordenes retrasadas
- Lista de ordenes recientes con su etapa actual
- Indicador de alertas/notificaciones pendientes

**Pedidos (Ventas)**
- Tabla con filtros por estado y fecha
- Formulario de creacion: Cliente, Proyecto, Fecha entrega, Observaciones
- Vista de detalle mostrando las ordenes de produccion asociadas

**Ordenes de Produccion (Ingenieria)**
- Crear ordenes a partir de un pedido existente
- Subir archivos (planos, despieces, OC)
- Boton para mover a "Espera de Materiales"

**Tablero Kanban (Produccion)** -- Vista estrella
- Columnas: Dimensionado | Enchapado | Maquinado | Armado | Empaquetado
- Cards con: numero de orden, cliente, indicador de retraso, icono de archivos adjuntos
- En movil: scroll horizontal con swipe entre columnas
- Al mover una tarjeta se registra automaticamente el timestamp en `orden_transiciones`
- Implementado con drag-and-drop tactil usando framer-motion (ya instalado)

**Calendario de Entregas**
- Vista mensual/semanal con las fechas de entrega de ordenes
- Indicadores de color por estado (en tiempo, retrasada, completada)

**Notificaciones**
- Campanita en el header con badge de no leidas
- Lista desplegable con notificaciones recientes
- Al presionar "Material Recibido" (Compras), se crea notificacion para usuarios con permiso de produccion

### 6. Flujo de Roles (via permisos existentes)

No se crean roles nuevos. Se usan los permisos granulares existentes (`user_permissions`):

| Submodulo | Ventas | Ingenieria | Compras | Produccion | Logistica | Admin |
|-----------|--------|------------|---------|------------|-----------|-------|
| pedidos | CRUD | R | R | R | R | CRUD |
| ordenes | R | CRUD | R | R | R | CRUD |
| kanban | R | R | R | CRUD | R | CRUD |
| calendario | R | R | R | R | CRUD | CRUD |

La asignacion se hace desde el panel de Admin existente, sin cambios en la UI de admin.

---

## Seccion Tecnica

### Migracion SQL (resumen)

```text
-- Enum para etapas
CREATE TYPE produccion_etapa AS ENUM (
  'ingenieria', 'espera_materiales', 'dimensionado',
  'enchapado', 'maquinado', 'armado', 'empaquetado', 'almacen'
);

-- Enum para estado de pedido
CREATE TYPE pedido_estado AS ENUM (
  'nuevo', 'en_ingenieria', 'en_produccion', 'completado', 'entregado'
);

-- 5 tablas: pedidos, ordenes_produccion, orden_archivos,
--           orden_transiciones, notificaciones_produccion

-- Storage bucket: produccion-archivos (public: false)

-- RLS: lectura abierta a autenticados,
--       escritura por user_permissions + admin
```

### Dependencias

No se requieren dependencias nuevas. Se usara:
- `framer-motion` (ya instalada) para drag-and-drop tactil en el Kanban
- `date-fns` (ya instalada) para el calendario
- Storage API de la plataforma para archivos

### Orden de implementacion

1. Migracion SQL (tablas + RLS + storage bucket)
2. Actualizar `modules.ts` (produccion -> active con submodulos)
3. Crear `ProduccionLayout.tsx` y `ProduccionPage.tsx` (router)
4. Agregar ruta en `App.tsx`
5. `ProduccionDashboard.tsx` con stats basicos
6. `PedidosPage.tsx` - CRUD de pedidos
7. `OrdenesPage.tsx` - Crear/gestionar ordenes + subida de archivos
8. `KanbanPage.tsx` - Tablero Kanban con drag tactil
9. `CalendarioPage.tsx` - Vista calendario
10. `NotificacionesPage.tsx` + `NotificationBell.tsx` - Sistema de alertas

Dado el tamano, se implementara en pasos incrementales para mantener calidad.
