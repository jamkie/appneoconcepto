
# Plan: Acumular Saldos Correctamente al Cerrar Cortes

## Problema

Al cerrar los cortes de Semana 6 y Semana 7, ambos generaron un saldo de $4,631.08 para Jose Luis Santes, pero el saldo final en la base de datos es solo $4,631.08 en lugar de $9,262.16.

**Causa raíz:** En la linea 1359 del archivo `CortesPage.tsx`, al cerrar un corte, el nuevo saldo simplemente **reemplaza** el saldo existente:

```text
nuevoSaldo = inst.saldoGenerado  (solo el saldo de ESTE corte)
```

Esto ignora cualquier saldo previamente acumulado que NO fue consumido como `saldoAnterior` en este corte.

**Ejemplo real:**
- Semana 7 se cerro primero: saldoAnterior=0, saldoGenerado=4,631.08 --> saldo_acumulado se pone en 4,631.08
- Semana 6 se cerro despues: saldoAnterior=0, saldoGenerado=4,631.08 --> saldo_acumulado se SOBREESCRIBE a 4,631.08 (deberia ser 9,262.16)

## Solucion

Cambiar la logica para que el nuevo saldo se **acumule** sobre el saldo existente, restando lo que ya fue consumido como `saldoAnterior`:

```text
ANTES:
nuevoSaldo = saldoGenerado

DESPUES:
saldoActual = leer saldo_acumulado actual de la BD
nuevoSaldo = saldoActual - saldoAnterior + saldoGenerado
```

**Logica:**
- `saldoActual`: lo que el instalador debe actualmente
- `saldoAnterior`: la parte del saldo anterior que YA se descontó en este corte (ya esta restada en la formula)
- `saldoGenerado`: nueva deuda generada por este corte
- Resultado: saldo previo menos lo que se consumio, mas lo nuevo generado

**Ejemplo corregido:**
- Semana 7 cierra primero: saldoActual=0, saldoAnterior=0, saldoGenerado=4631 --> nuevo = 0 - 0 + 4631 = 4,631.08
- Semana 6 cierra despues: saldoActual=4631, saldoAnterior=0, saldoGenerado=4631 --> nuevo = 4631 - 0 + 4631 = 9,262.16

## Cambio en Codigo

### Archivo: `src/modules/destajos/pages/CortesPage.tsx`

**Linea 1358-1370** - Leer saldo actual antes de actualizar:

```typescript
// ANTES (linea 1359):
const nuevoSaldo = inst.saldoGenerado;

// DESPUES:
const { data: currentSaldoData } = await supabase
  .from('saldos_instaladores')
  .select('saldo_acumulado')
  .eq('instalador_id', inst.id)
  .maybeSingle();

const saldoActual = Number(currentSaldoData?.saldo_acumulado) || 0;
const nuevoSaldo = saldoActual - inst.saldoAnterior + inst.saldoGenerado;
```

El resto del upsert (lineas 1361-1370) se mantiene igual.

## Resultado Esperado

- Cerrar multiples cortes para el mismo instalador acumulara correctamente los saldos
- El orden en que se cierren los cortes no afectara el resultado final
- Si un instalador tiene saldoAnterior que ya fue descontado, se resta del acumulado para no contar doble
