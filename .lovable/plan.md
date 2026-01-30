
# Plan: Corregir Fórmulas Inconsistentes de Saldo a Favor

## Problema Identificado

Hay **3 lugares** en `CortesPage.tsx` donde la fórmula del cálculo de pago **NO incluye los anticipos**, causando que se muestre saldo a favor incorrecto.

### Fórmula Correcta (ya implementada en 2 lugares):
```typescript
basePago = destajoAcumulado + anticiposEnCorte - salario - saldoAnterior - anticiposAplicadosManualmente
```

### Fórmula Incorrecta (encontrada en 2 lugares):
```typescript
basePago = destajoAcumulado - salario - saldoAnterior  // ❌ Falta anticiposEnCorte y anticiposAplicadosManualmente
```

## Ubicaciones del Bug

| Ubicación | Líneas | Función | Estado |
|-----------|--------|---------|--------|
| `handleViewCorte` | 692-693 | Carga inicial del corte | Correcta |
| `instaladoresCalculados` | 1199 | Cierre del corte | Correcta |
| **`getCalculatedValues`** | **2003** | Preview de salarios | **INCORRECTA** |
| **`handleSaveSalario`** | **2048** | Guardar salario editado | **INCORRECTA** |
| UI render | 2667 | Renderizado en tabla | Correcta |

## Cambios a Realizar

### Cambio 1: `getCalculatedValues` (líneas 2003)

```typescript
// ANTES (línea 2003):
const basePago = inst.destajoAcumulado - salario - inst.saldoAnterior;

// DESPUÉS:
const basePago = inst.destajoAcumulado + inst.anticiposEnCorte - salario - inst.saldoAnterior - inst.anticiposAplicadosManualmente;
```

También corregir la fórmula de `saldoGen` en la línea 2014:
```typescript
// ANTES:
const saldoGen = Math.max(0, salario - inst.destajoAcumulado + inst.saldoAnterior);

// DESPUÉS:
const saldoGen = Math.abs(basePago);
```

### Cambio 2: `handleSaveSalario` (líneas 2048)

```typescript
// ANTES (línea 2048):
const basePago = i.destajoAcumulado - newSalario - i.saldoAnterior;

// DESPUÉS:
const basePago = i.destajoAcumulado + i.anticiposEnCorte - newSalario - i.saldoAnterior - i.anticiposAplicadosManualmente;
```

Y corregir la fórmula de `saldo` en la línea 2060:
```typescript
// ANTES:
const saldo = Math.max(0, newSalario - i.destajoAcumulado + i.saldoAnterior);

// DESPUÉS:
const saldo = Math.abs(basePago);
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/modules/destajos/pages/CortesPage.tsx` | 4 líneas (2003, 2014, 2048, 2060) |

## Resultado Esperado

Después de los cambios, todos los instaladores usarán la misma fórmula consistente:

**Armando Arrastio:**
- Destajo: $2,000 + Anticipos: $2,000 - Salario: $2,315.54 = **$1,684.46**
- basePago > 0 → **No genera saldo a favor**
- A Depositar: $1,650

**Rafael Orozco:**
- Destajo: $0 + Anticipos: $20,000 - Salario: $2,315.54 = **$17,684.46**
- basePago > 0 → **No genera saldo a favor**
- A Depositar: $17,650
