
# Plan: Corregir Cálculo de "A Depositar" para Incluir Anticipos Otorgados

## Problema Identificado

El cálculo de "A Depositar" no incluye los anticipos otorgados (`anticiposEnCorte`). Para Armando Arrastio:

| Concepto | Valor |
|----------|-------|
| Avances (destajo) | $2,000 |
| Anticipos otorgados | $2,000 |
| Salario | $0 |
| **A Depositar (actual)** | $2,000 (incorrecto) |
| **A Depositar (esperado)** | **$4,000** |

## Causa Raíz

La fórmula actual en el código:
```typescript
const basePago = inst.destajoAcumulado - displaySalario - inst.saldoAnterior - inst.anticiposAplicadosManualmente;
```

No incluye `anticiposEnCorte` porque se pensó como "dinero aparte". Pero el depósito total que recibe el instalador **debe** incluir tanto el destajo como los anticipos otorgados.

## Solución

Cambiar la fórmula para incluir los anticipos otorgados en el cálculo del depósito:

```typescript
// ANTES:
const basePago = inst.destajoAcumulado - displaySalario - inst.saldoAnterior - inst.anticiposAplicadosManualmente;

// DESPUÉS:
// El depósito total incluye: destajo + anticipos otorgados - descuentos
const basePago = inst.destajoAcumulado + inst.anticiposEnCorte - displaySalario - inst.saldoAnterior - inst.anticiposAplicadosManualmente;
```

## Lógica Correcta

```text
DEPÓSITO TOTAL = Destajo + Anticipos Otorgados - Salario - Saldo Anterior - Anticipos Aplicados

Ejemplo Armando Arrastio:
  Destajo (avances):         $2,000
  + Anticipos otorgados:     $2,000
  - Salario:                     $0
  - Saldo anterior:              $0
  - Anticipos aplicados:         $0
  = A DEPOSITAR:             $4,000 ✅
```

## Archivos a Modificar

| Archivo | Ubicación | Cambio |
|---------|-----------|--------|
| `src/modules/destajos/pages/CortesPage.tsx` | ~línea 692-693 | Agregar `+ inst.anticiposEnCorte` a la fórmula `basePago` |
| `src/modules/destajos/pages/CortesPage.tsx` | ~línea 2667 | Agregar `+ inst.anticiposEnCorte` a la fórmula `basePago` (UI) |

## Cambios Específicos

### Cambio 1: Fórmula en `handleViewCorte` (cálculo del resumen)

Ubicación: `src/modules/destajos/pages/CortesPage.tsx` líneas 692-693

```typescript
// ANTES:
const basePago =
  inst.destajoAcumulado - inst.salarioSemanal - inst.saldoAnterior - inst.anticiposAplicadosManualmente;

// DESPUÉS:
const basePago =
  inst.destajoAcumulado + inst.anticiposEnCorte - inst.salarioSemanal - inst.saldoAnterior - inst.anticiposAplicadosManualmente;
```

### Cambio 2: Fórmula en renderizado UI

Ubicación: `src/modules/destajos/pages/CortesPage.tsx` línea 2667

```typescript
// ANTES:
const basePago = inst.destajoAcumulado - displaySalario - inst.saldoAnterior - inst.anticiposAplicadosManualmente;

// DESPUÉS:
const basePago = inst.destajoAcumulado + inst.anticiposEnCorte - displaySalario - inst.saldoAnterior - inst.anticiposAplicadosManualmente;
```

### Cambio 3: Fórmula en `handleCloseCorte` (al cerrar el corte)

Verificar que la fórmula de cierre también incluya los anticipos otorgados para que el `monto_depositado` en `corte_instaladores` sea correcto.

### Cambio 4: Excel Export

Ubicación: `src/modules/destajos/hooks/useExportCorteExcel.ts`

Verificar que la fórmula del Excel también refleje este cambio.

## Resultado Esperado

Para Armando Arrastio en Semana 5:
- Destajo: $2,000
- +Anticipo: $2,000  
- Salario: $0
- **A Depositar: $4,000** (suma de destajo + anticipos)

Los anticipos quedarán registrados como deuda pendiente ($2,000) que puede aplicarse manualmente en futuros cortes.
