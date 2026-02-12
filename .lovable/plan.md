

# Revision del Codigo: Problemas Encontrados

## Bug 1: Formula inconsistente para cortes cerrados en la UI (CortesPage.tsx)

**Linea 683-685** - En la UI, cuando un corte esta cerrado, la formula para `destajoADepositar` NO incluye `anticiposEnCorte`:

```text
// UI (cerrado): destajoAcumulado - salario - saldoAnterior - aplicados
// UI (abierto): destajoAcumulado + anticiposEnCorte - salario - saldoAnterior - aplicados
// Excel:        destajoAcumulado + anticiposEnCorte - salario - saldoAnterior - aplicados
// Cierre:       destajoAcumulado + anticiposEnCorte - salario - saldoAnterior - aplicados
```

La UI para cortes cerrados esta **faltando `+ anticiposEnCorte`**. Esto hace que el "Destajo a Depositar" mostrado en cortes cerrados sea incorrecto si habia anticipos otorgados.

**Correccion:** Agregar `+ inst.anticiposEnCorte` en la linea 685.

## Bug 2: Doble conteo de saldoAnterior en el Excel (useExportCorteExcel.ts)

Para **cortes abiertos**, el Excel inicializa `saldoAnterior` con el valor actual de la BD (`saldosMap[inst.id]`, linea 115) y luego **suma** las solicitudes tipo `saldo` encima (linea 134). Pero las solicitudes tipo `saldo` representan exactamente el saldo que se aplico como descuento, no un monto adicional.

En la UI (CortesPage), `saldoAnterior` empieza en 0 y solo se llena con solicitudes tipo `saldo`. Esto es correcto porque las solicitudes tipo `saldo` SON el saldo anterior aplicado.

El Excel esta **sumando el saldo de la BD + solicitudes saldo**, lo cual es un doble conteo.

**Correccion:** Inicializar `saldoAnterior` en 0 (como la UI) en lugar de `saldosMap[inst.id]` en la linea 115. Los saldos de la BD ya estan representados por las solicitudes tipo `saldo` asignadas al corte.

## Bug 3: Variable no utilizada en el Excel

`solicitudIdsEnCorte` (linea 101) se declara pero nunca se usa. Es codigo muerto.

**Correccion:** Eliminar la linea.

## Resumen de cambios

### Archivo: `src/modules/destajos/pages/CortesPage.tsx`
- Linea 683-685: Agregar `+ inst.anticiposEnCorte` a la formula de `destajoADepositar` para cortes cerrados

### Archivo: `src/modules/destajos/hooks/useExportCorteExcel.ts`
- Linea 115: Cambiar `saldoAnterior: saldosMap[inst.id] || 0` a `saldoAnterior: 0` para evitar doble conteo en cortes abiertos
- Linea 101: Eliminar la variable `solicitudIdsEnCorte` que no se usa

Nota: Para cortes **cerrados**, el Excel ya sobrescribe `saldoAnterior` con `ci.saldo_anterior` (linea 159), asi que el bug 2 solo afecta cortes abiertos.
