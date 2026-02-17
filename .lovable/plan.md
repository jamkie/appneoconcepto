

# Cambio en formula SUB TOTAL FACTURA

## Cambio
En el archivo `src/modules/destajos/hooks/useExportCorteExcel.ts`, linea 367:

- **Actual:** `D${totalRowNumResumen}/1.06`
- **Nuevo:** `D${totalRowNumResumen}/1.035`

Tambien se actualiza el comentario en la linea 361 de `1.06` a `1.035`.

Es un cambio de una sola linea en la hoja "Resumen Depositos" del Excel exportado.

