

# Plan: Agregar boton "Aplicar" anticipos desde el detalle del Corte

## Problema

Cuando se reabre un corte, los anticipos aplicados se restauran correctamente (se eliminan las solicitudes `aplicacion_anticipo` y se devuelve el `monto_disponible`). Sin embargo, al volver a cerrar el corte, los anticipos **no se re-aplican automaticamente** porque la aplicacion es manual. El problema es que la columna "Disponibles" en la tabla del corte solo muestra el monto informativo, pero **no tiene un boton para aplicarlos**.

## Solucion

Agregar un boton "Aplicar" en la columna "Disponibles" de cada instalador que tenga anticipos disponibles, el cual abrira el `ApplyAnticipoModal` existente para seleccionar y aplicar los anticipos deseados.

## Cambios en `src/modules/destajos/pages/CortesPage.tsx`

### 1. Importar el componente ApplyAnticipoModal

Agregar el import de `ApplyAnticipoModal` desde `../components/ApplyAnticipoModal`.

### 2. Agregar estado para el modal de anticipos

Nuevas variables de estado:
- `isApplyAnticipoOpen`: booleano para controlar visibilidad del modal
- `currentAnticipoInstalador`: objeto con `id` y `nombre` del instalador seleccionado

### 3. Modificar la columna "Disponibles" en la tabla (lineas ~2757-2764)

Cambiar el texto plano del monto disponible por un boton que al hacer clic:
1. Guarde el `id` y `nombre` del instalador
2. Abra el `ApplyAnticipoModal`

```text
Antes:  "$5,000"  (solo texto)
Despues: "$5,000 [Aplicar]"  (texto + boton)
```

### 4. Agregar el componente ApplyAnticipoModal al render

Renderizar el modal pasando:
- `instaladorId` y `instaladorNombre` del instalador seleccionado
- `corteId` y `corteNombre` del corte actual
- `solicitudIdsEnCorte` para excluir anticipos del propio corte
- `userId` del usuario actual
- `onSuccess` que refresque los datos del corte (llamar a `fetchCorteDetail` o similar)

### 5. Handler de exito

Al cerrar el modal exitosamente, refrescar el resumen del corte para que la columna "Disponibles" y "-Aplicados" se actualicen con los nuevos valores.

## Resultado esperado

1. El usuario reabre un corte
2. Los anticipos se restauran automaticamente (esto ya funciona)
3. En la tabla del corte abierto, la columna "Disponibles" muestra un boton "Aplicar" junto al monto
4. Al hacer clic, se abre el modal para seleccionar que anticipos aplicar
5. Al confirmar, se crean las solicitudes `aplicacion_anticipo` y se reduce el `monto_disponible`
6. La tabla se refresca mostrando los nuevos valores en "-Aplicados" y "A Depositar"
7. El usuario cierra el corte normalmente con los anticipos ya aplicados
