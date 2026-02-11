

# Plan: Mostrar Anticipos Aplicados en el Detalle de la Solicitud

## Problema

Cuando se aplican anticipos al registrar un avance, se crean solicitudes tipo `aplicacion_anticipo` vinculadas al mismo `avance_id`. Sin embargo, al ver el detalle de la solicitud de avance en la pagina de Solicitudes, no se muestran esos anticipos aplicados.

## Solucion

Agregar una seccion en el detalle de la solicitud que muestre los anticipos aplicados al mismo avance.

## Cambios

### `src/modules/destajos/pages/SolicitudesPage.tsx`

**En `handleViewSolicitud`:**
- Despues de cargar los avance items, buscar solicitudes tipo `aplicacion_anticipo` que compartan el mismo `avance_id`
- Guardar esos datos en un nuevo estado `anticiposAplicados`

**En el dialog de detalle (lineas ~1182-1346):**
- Agregar una nueva seccion visual (similar al desglose de extras) que muestre los anticipos aplicados:
  - Obra de origen del anticipo
  - Monto aplicado
  - Total de descuentos por anticipos
- Mostrar el monto neto (total solicitado - anticipos aplicados) como referencia

### Nuevo estado

```typescript
const [anticiposAplicadosDetail, setAnticiposAplicadosDetail] = useState<
  { id: string; total_solicitado: number; observaciones: string | null; obras: { nombre: string } | null }[]
>([]);
```

### Consulta adicional en `handleViewSolicitud`

Cuando la solicitud tenga `avance_id` y sea tipo `avance`:

```typescript
const { data: aplicaciones } = await supabase
  .from('solicitudes_pago')
  .select('id, total_solicitado, observaciones, obras(nombre)')
  .eq('avance_id', solicitud.avance_id)
  .eq('tipo', 'aplicacion_anticipo');
```

### Seccion visual en el detalle

Despues del desglose de montos, mostrar una seccion con icono y fondo azul/indigo que liste cada anticipo aplicado con su monto, y un total de descuentos. Esto dara visibilidad inmediata de que el avance ya tiene anticipos descontados.
