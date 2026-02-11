
## Plan: Restaurar Anticipo Parcial de Rafael Orozco

### Acción
Restaurar el `monto_disponible` del anticipo parcial de Rafael Orozco de $16,850 a $20,000, revirtiendo los $3,150 que fueron aplicados durante la prueba.

### Detalles Técnicos
**Registro a actualizar:**
- ID: `70124d8e-fa57-413e-a360-04cd144fbef4`
- Tabla: `anticipos`
- Campo: `monto_disponible`
- Valor actual: 16850
- Valor nuevo: 20000

**Ejecución:**
Se ejecutará una consulta SQL UPDATE que establecerá el `monto_disponible` a 20000 para el registro especificado.

### Resultado Esperado
El anticipo de Rafael Orozco para "Semana 5 - Enero 2026" volverá a mostrar su monto original completo de $20,000 disponibles.

