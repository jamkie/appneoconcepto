

# Plan: Limitar Anticipo al Monto del Avance

## Problema

Al aplicar un anticipo despues de registrar un avance, el sistema permite aplicar mas anticipo que el valor del avance mismo. Ejemplo: avance de $6,975 pero se pudo aplicar anticipo de $15,000.

## Solucion

Agregar un prop `montoMaximo` al modal de anticipos que limite el total aplicable al monto del avance del instalador.

## Cambios

### 1. `src/modules/destajos/pages/AvancesPage.tsx`

- Agregar `montoAvance` al tipo de la cola de anticipos: `{ id: string; nombre: string; obraId: string; montoAvance: number }`
- Calcular `totalConDescuento` por instalador y pasarlo al queue al detectar anticipos disponibles (linea 656)
- Pasar `montoMaximo={currentAnticipoInstalador.montoAvance}` al componente `ApplyAnticipoModal` (linea 1761)

### 2. `src/modules/destajos/components/ApplyAnticipoModal.tsx`

- Agregar prop opcional `montoMaximo?: number` a la interfaz
- En `handleToggleAnticipo`: al seleccionar un anticipo, limitar el monto pre-llenado al espacio disponible considerando lo ya seleccionado y el tope maximo
- En `handleMontoChange`: ademas del clamp por `monto_disponible`, validar que la suma total no exceda `montoMaximo`
- En el boton "Aplicar": deshabilitar si `montoTotal > montoMaximo`
- Mostrar el monto del avance en el resumen inferior junto a "Total disponible" y "A aplicar" para que el usuario vea el limite
- Mostrar advertencia visual si el total a aplicar alcanza el tope

## Seccion Tecnica

### Calculo del montoAvance por instalador

En `AvancesPage.tsx`, al construir la cola de anticipos (~linea 646):

```typescript
for (const inst of selectedInstaladores) {
  // ... check anticipos disponibles ...
  if (anticiposDisponibles && anticiposDisponibles.length > 0) {
    const porcentajeFactor = inst.porcentaje / 100;
    const subtotalInst = subtotalPiezas * porcentajeFactor;
    const montoDescuento = subtotalInst * (descuento / 100);
    const totalConDescuento = subtotalInst - montoDescuento;
    
    instaladoresConAnticipos.push({
      id: inst.instalador_id,
      nombre,
      obraId: selectedObraId,
      montoAvance: totalConDescuento,
    });
  }
}
```

### Logica de clamp en el modal

```typescript
// En handleMontoChange:
const otrosSeleccionados = updated
  .filter(a => a.id !== id)
  .reduce((sum, a) => sum + (a.montoAplicar || 0), 0);
const espacioDisponible = montoMaximo
  ? montoMaximo - otrosSeleccionados
  : Infinity;
const clampedValue = Math.min(
  Math.max(0, value),
  a.monto_disponible,
  espacioDisponible
);
```

### UI del resumen

Se agrega una tercera columna "Monto del avance" mostrando `montoMaximo` cuando esta presente, para que el usuario tenga visibilidad del tope.
