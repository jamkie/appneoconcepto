
# Plan: Agregar Ordenamiento por Columnas en Tablas del Módulo Destajos

## Resumen

Implementar funcionalidad de ordenamiento (ascendente/descendente) al hacer clic en los encabezados de las columnas en las siguientes páginas:
- **Obras** 
- **Instaladores**
- **Avances**
- **Extras**
- **Solicitudes**
- **Pagos**

## Comportamiento Esperado

- Al hacer clic en el encabezado de una columna, los datos se ordenan de forma **ascendente**
- Al hacer clic nuevamente, cambia a orden **descendente**
- Un tercer clic vuelve a ascendente
- Se muestra un indicador visual (flecha ↑ o ↓) en la columna actualmente ordenada

## Enfoque de Implementación

### 1. Mejorar el Componente `DataTable`

Actualizar el componente compartido para soportar ordenamiento:

- Agregar prop `sortKey` opcional a cada columna para indicar la clave de ordenamiento
- Agregar estado interno para `sortColumn` y `sortDirection`
- Agregar función `getValue` opcional para extraer el valor comparable
- Mostrar iconos de ordenamiento en los encabezados clicables

### 2. Actualizar Cada Página

Agregar las claves de ordenamiento y funciones de extracción de valores a las definiciones de columnas.

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/modules/destajos/components/DataTable.tsx` | Agregar lógica de ordenamiento y UI de indicadores |
| `src/modules/destajos/pages/PagosPage.tsx` | Agregar `sortKey` y `getValue` a columnas |
| `src/modules/destajos/pages/InstaladoresPage.tsx` | Agregar `sortKey` y `getValue` a columnas |
| `src/modules/destajos/pages/ObrasPage.tsx` | Agregar `sortKey` y `getValue` a columnas |
| `src/modules/destajos/pages/SolicitudesPage.tsx` | Agregar `sortKey` y `getValue` a columnas |
| `src/modules/destajos/pages/AvancesPage.tsx` | Migrar a DataTable con ordenamiento |
| `src/modules/destajos/pages/ExtrasPage.tsx` | Migrar a DataTable con ordenamiento |

---

## Detalles Técnicos

### Cambios en `DataTable.tsx`

```typescript
interface Column<T> {
  key: string;
  header: string | (() => React.ReactNode);
  cell: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  // Nuevas propiedades para ordenamiento
  sortKey?: string;
  getValue?: (item: T) => string | number | Date | null;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyState?: React.ReactNode;
  // Nuevas props opcionales
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
}
```

**Lógica de ordenamiento:**
- Estado: `sortColumn` (string | null), `sortDirection` ('asc' | 'desc')
- Función `handleSort(columnKey)` que alterna la dirección
- Ordenar `data` antes de renderizar usando `getValue` o acceso directo por key
- Iconos: `ArrowUp`, `ArrowDown`, `ArrowUpDown` (sin ordenar)

### Ejemplo de Columna con Ordenamiento

**PagosPage.tsx:**
```typescript
{
  key: 'fecha',
  header: 'Fecha',
  sortKey: 'fecha',
  getValue: (item) => new Date(item.fecha).getTime(),
  cell: (item) => format(new Date(item.fecha), 'dd/MM/yyyy', { locale: es }),
},
{
  key: 'monto',
  header: 'Monto',
  sortKey: 'monto',
  getValue: (item) => Number(item.monto),
  cell: (item) => formatCurrency(Number(item.monto)),
},
```

### Columnas Ordenables por Página

**Pagos:**
- Fecha (date)
- Obra (string)
- Instalador (string)
- Monto (number)
- Método (string)

**Instaladores:**
- Nombre (string)
- Banco (string)
- Salario Semanal (number)
- Estado (boolean)

**Obras:**
- Nombre (string)
- Responsable (string)
- Monto Total (number calculado)
- Total Pagado (number)

**Avances:**
- Fecha (date)
- Obra (string)
- Instalador (string)
- Total (number)
- Estado (string)

**Extras:**
- Descripción (string)
- Obra (string)
- Instalador (string)
- Monto (number)
- Estado (string)

**Solicitudes:**
- Fecha (date)
- Obra (string)
- Instalador (string)
- Tipo (string)
- Total (number)
- Estado (string)

---

## Diseño Visual del Encabezado Ordenable

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Fecha ↓         │ Obra ↕          │ Monto ↕         │
├─────────────────┼─────────────────┼─────────────────┤
│ 01/01/2025      │ Casa Rosa       │ $5,000.00       │
│ 31/12/2024      │ Edificio Norte  │ $3,500.00       │
└─────────────────┴─────────────────┴─────────────────┘

Leyenda:
↓ = Ordenado descendente (activo)
↑ = Ordenado ascendente (activo)
↕ = Sin ordenar (clic para ordenar)
```

## Resultado Esperado

- Todas las tablas del módulo destajos tendrán la capacidad de ordenarse
- El usuario podrá hacer clic en cualquier encabezado para cambiar el orden
- Experiencia consistente en todas las páginas
- Indicadores visuales claros del estado de ordenamiento
