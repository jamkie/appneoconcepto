

# Plan: Mover Aplicacion de Anticipos al Registro de Avance

## Resumen

Despues de guardar un avance (nuevo o editado), el sistema verificara si el instalador tiene anticipos disponibles. Si los tiene, se abrira el modal de seleccion de anticipos para que el usuario decida cuanto descontar. El boton de anticipos en el detalle del corte sera eliminado.

## Cambios a Realizar

### 1. Archivo: `src/modules/destajos/pages/AvancesPage.tsx`

**Agregar estado y logica para el modal de anticipos:**

- Importar `ApplyAnticipoModal` desde `../components/ApplyAnticipoModal`
- Agregar estados nuevos:
  - `isApplyAnticipoOpen` (boolean)
  - `applyAnticipoData` (objeto con instalador info, obra_id, etc.)
- Modificar `handleSave`: despues de guardar exitosamente el avance (tanto nuevo como editado), verificar si alguno de los instaladores del avance tiene anticipos disponibles (`monto_disponible > 0`). Si los tiene, abrir el modal de anticipos en lugar de cerrar el formulario inmediatamente.
- Si hay multiples instaladores en el avance, se abriran secuencialmente (uno por uno).
- Al cerrar el modal (o si no hay anticipos), continuar con el flujo normal (resetForm, cerrar modal, refrescar datos).

**Adaptar el modal:**

El `ApplyAnticipoModal` actual requiere `corteId` y `corteNombre`. Como ahora se usara desde avances (sin corte), se necesita:
- Crear la solicitud de tipo `aplicacion_anticipo` **sin** `corte_id` (sera null, indicando que fue aplicado manualmente desde avance)
- O bien, hacer que `corteId` y `corteNombre` sean opcionales en el modal

### 2. Archivo: `src/modules/destajos/components/ApplyAnticipoModal.tsx`

**Hacer corteId y corteNombre opcionales:**

- Cambiar la interfaz para que `corteId` y `corteNombre` sean opcionales (`corteId?: string`)
- Ajustar la insercion de `solicitudes_pago` para que `corte_id` sea `corteId || null`
- Ajustar el texto de `observaciones` para indicar si fue aplicado desde avance o desde corte
- Agregar un prop opcional `obraId` para filtrar anticipos solo de la obra del avance (mas relevante contextualmente)

### 3. Archivo: `src/modules/destajos/pages/CortesPage.tsx`

**Eliminar la funcionalidad de anticipos del corte:**

- Remover el import de `ApplyAnticipoModal`
- Remover los estados `isApplyAnticipoOpen` y `applyAnticipoInstalador`
- Remover el boton "Aplicar Anticipo" del detalle del instalador en el corte
- Remover el componente `ApplyAnticipoModal` del JSX

## Flujo Resultante

```text
1. Usuario registra avance en obra
2. Se guardan avance_items + solicitudes_pago
3. Sistema consulta: tiene anticipos disponibles este instalador?
   - SI: Abre modal de anticipos para seleccionar montos
   - NO: Cierra formulario normalmente
4. Usuario selecciona anticipos y montos a aplicar
5. Se descuenta monto_disponible de cada anticipo seleccionado
6. Se cierra modal y refresca datos
```

## Seccion Tecnica

### Verificacion de anticipos despues de guardar

Despues de guardar exitosamente, para cada instalador del avance:

```typescript
const { data: anticiposDisponibles } = await supabase
  .from('anticipos')
  .select('id')
  .eq('instalador_id', instaladorId)
  .gt('monto_disponible', 0)
  .limit(1);

if (anticiposDisponibles && anticiposDisponibles.length > 0) {
  // Abrir modal de anticipos para este instalador
}
```

### Manejo de multiples instaladores

Si el avance tiene 2+ instaladores con anticipos disponibles, se procesaran en secuencia usando una cola:

```typescript
const [anticipoQueue, setAnticipoQueue] = useState<{id: string, nombre: string}[]>([]);
```

Cuando se cierra el modal del primer instalador, se abre el del siguiente hasta vaciar la cola.

### Cambios en ApplyAnticipoModal

- `corteId?: string` - Opcional, sera null cuando se aplique desde avance
- `corteNombre?: string` - Opcional
- La solicitud generada usara `corte_id: corteId || null`
- Observaciones indicaran: "Aplicacion manual de anticipo al avance" en lugar de "al corte: X"

