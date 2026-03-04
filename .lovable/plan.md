

# Diagnóstico: Aprobación bloqueada por validación de presupuesto

## Problema Identificado

Al aprobar la solicitud de "Fuente del Sol", la función `aprobarSolicitud` (línea 317-472 de `SolicitudesPage.tsx`) ejecuta una validación de presupuesto que **cuenta los anticipos otorgados como pagos ya realizados**, inflando artificialmente el `totalPagado` y reduciendo el `saldoPendiente` a un valor menor que el monto de la solicitud.

Líneas 366-368:
```
const totalAnticiposOtorgados = anticipos.monto_original → se suma como "ya pagado"
const totalPagado = totalPagadoDirecto + totalAnticiposOtorgados  // ← inflado
const saldoPendiente = totalObra - totalPagado  // ← muy bajo
```

Línea 375: `if (montoSolicitud > saldoPendiente)` → bloquea la aprobación con el mensaje de error.

El anticipo se dio al instalador como adelanto, así que **sí cuenta como valor desembolsado para la obra**, pero al momento de aprobar una solicitud de avance que incluirá ese descuento, el sistema interpreta que "ya no queda saldo" porque el anticipo ya consumió parte del presupuesto.

## Solución

Modificar la validación de presupuesto en `aprobarSolicitud` para que, cuando se están aplicando anticipos como descuento, reste el `totalAnticiposAplicados` del `montoSolicitud` antes de comparar contra el saldo pendiente. Es decir, validar con el **monto efectivo** (`montoEfectivo = montoSolicitud - totalAnticiposAplicados`) en lugar del monto bruto.

La variable `montoEfectivo` ya se calcula en la línea 326 pero no se usa en la validación.

### Cambio en `SolicitudesPage.tsx`

Línea 375: cambiar de:
```ts
if (montoSolicitud > saldoPendiente)
```
a:
```ts
if (montoEfectivo > saldoPendiente)
```

Esto permite que la solicitud se apruebe cuando el monto neto (después de descontar anticipos) cabe dentro del saldo pendiente de la obra. Es un cambio de una sola línea.

## Impacto

- Solo afecta la validación de presupuesto al aprobar solicitudes
- No cambia la lógica de aplicación de anticipos (que ocurre al cerrar el corte)
- Mantiene la protección contra sobrepagos reales

