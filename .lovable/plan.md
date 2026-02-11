
# Plan: Incluir Instaladores Sin Trabajo en el Cierre de Corte

## Problema

Jose Luis Santes fue excluido del corte Semana 7 porque no tenía solicitudes, destajo, anticipos ni saldo anterior. Sin embargo, se le pagó nómina ($4,631.08), lo que debería haber generado un **saldo a favor de la empresa** por ese mismo monto.

El filtro en la línea 1187-1191 de `CortesPage.tsx` excluye a cualquier instalador que no tenga actividad:

```typescript
// FILTRO PROBLEMÁTICO (línea 1189-1191):
const instaladoresConSolicitudes = instaladoresIncluidos.filter(inst => 
  inst.solicitudes.length > 0 || inst.destajoAcumulado > 0 || inst.anticiposEnCorte > 0 || inst.saldoAnterior > 0 || inst.anticiposAplicadosManualmente > 0
);
```

Esto impide que un instalador que solo recibe salario (sin trabajo registrado) genere la deuda correspondiente al cerrar el corte.

## Solución

Eliminar ese filtro restrictivo. Si un instalador fue **marcado manualmente** (no está en `excludedInstaladores`), debe ser incluido en el cierre del corte. El cálculo de basePago ya maneja correctamente el caso:

- Destajo: $0 + Anticipos: $0 - Salario: $4,631.08 = **-$4,631.08**
- basePago < 0 => Saldo generado: **$4,631.08**

## Cambios a Realizar

### Archivo: `src/modules/destajos/pages/CortesPage.tsx`

**Líneas 1187-1191** - Eliminar el filtro restrictivo y usar directamente `instaladoresIncluidos`:

```typescript
// ANTES:
const instaladoresConSolicitudes = instaladoresIncluidos.filter(inst => 
  inst.solicitudes.length > 0 || inst.destajoAcumulado > 0 || ...
);
const instaladoresCalculados = instaladoresConSolicitudes.map(inst => { ... });

// DESPUÉS:
const instaladoresCalculados = instaladoresIncluidos.map(inst => { ... });
```

Tambien actualizar la validación de corte vacío (línea 1221) para verificar contra `instaladoresCalculados` en lugar de `instaladoresConSolicitudes`.

## Resultado Esperado

- Los instaladores marcados (no excluidos) que solo reciben salario sin trabajo generarán un **saldo a favor** al cerrar el corte
- Jose Luis Santes con salario $4,631.08 y $0 de destajo generará un saldo a favor de $4,631.08
- Los instaladores que el usuario **desmarcó** (excluyó manualmente) seguirán sin ser procesados
- No afecta el comportamiento de instaladores con trabajo registrado
