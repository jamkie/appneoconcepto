import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import type { CorteSemanal } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InstaladorPago {
  nombre: string;
  jefesDirectos: string;
  banco: string;
  clabe: string;
  destajoAcumulado: number;
  nominaSemanal: number;
  saldoAnterior: number;
  anticiposEnCorte: number; // Anticipos OTORGADOS en este corte
  anticiposAplicadosManualmente: number; // Anticipos aplicados manualmente (descuento)
  destajoADepositar: number;
  aDepositar: number;
  saldoAFavor: number;
  saldoAcumuladoTotal: number;
}

export const useExportCorteExcel = () => {
  const exportCorteToExcel = async (corte: CorteSemanal) => {
    try {
      // Fetch solicitudes for this corte with instalador details
      const { data: solicitudes, error: solError } = await supabase
        .from('solicitudes_pago')
        .select(`
          total_solicitado,
          instalador_id,
          solicitado_por,
          tipo
        `)
        .eq('corte_id', corte.id);

      if (solError) throw solError;

      // Get unique solicitado_por IDs to fetch their names
      const solicitadoPorIds = [...new Set((solicitudes || []).map((s: any) => s.solicitado_por).filter(Boolean))];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', solicitadoPorIds);

      // Create a map of user_id -> first name
      const profileNames: Record<string, string> = {};
      (profilesData || []).forEach((p: any) => {
        const firstName = p.full_name?.split(' ')[0]?.toUpperCase() || '';
        profileNames[p.id] = firstName;
      });

      // Fetch saldos or corte_instaladores depending on corte state
      let saldosMap: Record<string, number> = {};
      let corteInstaladoresMap: Record<string, any> = {};
      
      // Always fetch current saldos acumulados for the new column
      const { data: saldosData } = await supabase
        .from('saldos_instaladores')
        .select('instalador_id, saldo_acumulado');
      
      (saldosData || []).forEach((s: any) => {
        saldosMap[s.instalador_id] = Number(s.saldo_acumulado) || 0;
      });
      
      // Get the list of instaladores that are PART of this corte
      let involvedInstaladorIds: string[] = [];
      
      if (corte.estado === 'cerrado') {
        // Use historical data from corte_instaladores (only those who were included)
        const { data: ciData } = await supabase
          .from('corte_instaladores')
          .select('*')
          .eq('corte_id', corte.id);
        
        (ciData || []).forEach((ci: any) => {
          corteInstaladoresMap[ci.instalador_id] = ci;
          involvedInstaladorIds.push(ci.instalador_id);
        });
      } else {
        // For open cortes, get instaladores from solicitudes assigned to this corte
        const solicitudInstaladorIds = [...new Set((solicitudes || []).map((s: any) => s.instalador_id).filter(Boolean))];
        involvedInstaladorIds = solicitudInstaladorIds;
      }

      // Fetch ONLY the instaladores involved in this corte
      let allInstaladores: any[] = [];
      if (involvedInstaladorIds.length > 0) {
        const { data: instData, error: instError } = await supabase
          .from('instaladores')
          .select('id, nombre, nombre_banco, numero_cuenta, salario_semanal')
          .in('id', involvedInstaladorIds)
          .order('nombre');
        
        if (instError) throw instError;
        allInstaladores = instData || [];
      }

      // Fetch anticipos disponibles (from previous cortes) for all instaladores
      const solicitudIdsEnCorte = new Set((solicitudes || []).map((s: any) => s.id));

      // Build instalador map with ONLY involved instaladores
      const instaladorMap: Record<string, InstaladorPago & { jefes: Set<string> }> = {};
      
      // Initialize only involved instaladores
      (allInstaladores).forEach((inst: any) => {
        instaladorMap[inst.id] = {
          nombre: inst.nombre?.toUpperCase() || 'SIN NOMBRE',
          jefesDirectos: '',
          banco: inst.nombre_banco?.toUpperCase() || '',
          clabe: inst.numero_cuenta || '',
          destajoAcumulado: 0,
          nominaSemanal: inst.salario_semanal || 0,
          saldoAnterior: saldosMap[inst.id] || 0,
          anticiposEnCorte: 0,
          anticiposAplicadosManualmente: 0, // Only manual applications
          destajoADepositar: 0,
          aDepositar: 0,
          saldoAFavor: 0,
          saldoAcumuladoTotal: saldosMap[inst.id] || 0,
          jefes: new Set(),
        };
      });
      
      // Add solicitudes data
      (solicitudes || []).forEach((sol: any) => {
        if (instaladorMap[sol.instalador_id]) {
          if (sol.tipo === 'anticipo') {
            // Anticipos OTORGADOS en este corte
            instaladorMap[sol.instalador_id].anticiposEnCorte += Number(sol.total_solicitado) || 0;
          } else if (sol.tipo === 'saldo') {
            // Saldos aplicados se suman al saldoAnterior
            instaladorMap[sol.instalador_id].saldoAnterior += Number(sol.total_solicitado) || 0;
          } else if (sol.tipo === 'aplicacion_anticipo') {
            // Aplicaciones manuales de anticipos
            instaladorMap[sol.instalador_id].anticiposAplicadosManualmente += Number(sol.total_solicitado) || 0;
          } else {
            // Work requests add to destajo
            instaladorMap[sol.instalador_id].destajoAcumulado += Number(sol.total_solicitado) || 0;
          }
          
          // Add the person who registered this solicitud as "jefe directo"
          if (sol.solicitado_por && profileNames[sol.solicitado_por]) {
            instaladorMap[sol.instalador_id].jefes.add(profileNames[sol.solicitado_por]);
          }
        }
      });

       // Calculate derived fields
      Object.entries(instaladorMap).forEach(([instId, inst]) => {
        inst.jefesDirectos = Array.from(inst.jefes).join(' ');
        
        if (corte.estado === 'cerrado' && corteInstaladoresMap[instId]) {
          // Use historical data (frozen at close time)
          const ci = corteInstaladoresMap[instId];
          inst.destajoAcumulado = Number(ci.destajo_acumulado);
          inst.nominaSemanal = Number(ci.salario_semanal);
          inst.saldoAnterior = Number(ci.saldo_anterior);
          inst.aDepositar = Number(ci.monto_depositado);
          inst.saldoAFavor = Number(ci.saldo_generado);
          inst.destajoADepositar = Math.max(
            0,
            inst.destajoAcumulado + inst.anticiposEnCorte - inst.nominaSemanal - inst.saldoAnterior - inst.anticiposAplicadosManualmente
          );
        } else {
          // Calculate in real-time
          // Formula: basePago = Destajo + AnticiposOtorgados - Salario - SaldoAnterior - AnticiposAplicadosManualmente
          const basePago =
            inst.destajoAcumulado + inst.anticiposEnCorte - inst.nominaSemanal - inst.saldoAnterior - inst.anticiposAplicadosManualmente;
          
          if (basePago >= 0) {
            inst.destajoADepositar = basePago;
            inst.aDepositar = Math.floor(basePago / 50) * 50;
            inst.saldoAFavor = 0;
          } else {
            inst.destajoADepositar = 0;
            inst.aDepositar = 0;
            inst.saldoAFavor = Math.abs(basePago);
          }
        }
      });

      const instaladores = Object.values(instaladorMap).sort((a, b) => 
        a.nombre.localeCompare(b.nombre)
      );

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.created = new Date();
      
      const sheet = workbook.addWorksheet('Relación de Pago');

      // Format dates for title
      const fechaInicio = format(new Date(corte.fecha_inicio), 'dd', { locale: es });
      const fechaFin = format(new Date(corte.fecha_fin), 'dd \'DE\' MMMM', { locale: es }).toUpperCase();
      const weekNum = corte.nombre.match(/Semana (\d+)/i)?.[1] || '01';

      // Add title row
      sheet.mergeCells('A1:M1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `PAGO SEMANAL INSTALADORES SEMANA ${weekNum} DEL ${fechaInicio} AL ${fechaFin}`;
      titleCell.font = { bold: true, size: 12 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 25;

      // Empty row
      sheet.addRow([]);

      // Define headers (includes both ANTICIPOS columns)
      const headers = [
        'NOMBRE DEL TRABAJADOR',
        'JEFES DIRECTOS',
        'BANCO',
        'CLABE',
        'DESTAJO ACUMULADO',
        'NOMINA SEMANAL',
        'SALDO ANTERIOR',
        '+ANTICIPOS',
        '-APLICADOS',
        'DESTAJO A DEPOSITAR',
        'A DEPOSITAR',
        'SALDO A FAVOR',
        'SALDO ACUMULADO TOTAL',
      ];
      
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 30;

      sheet.columns = [
        { width: 35 }, // A
        { width: 15 }, // B
        { width: 14 }, // C
        { width: 20 }, // D
        { width: 18 }, // E
        { width: 16 }, // F
        { width: 16 }, // G
        { width: 14 }, // H
        { width: 14 }, // I
        { width: 20 }, // J
        { width: 14 }, // K
        { width: 14 }, // L
        { width: 22 }, // M: Saldo Acumulado Total
      ];

       // Add data rows with formulas
      const dataStartRow = 4; // Row where data starts (after title, empty, headers)
      
      instaladores.forEach((inst) => {
        const rowNum = sheet.rowCount + 1;
        const row = sheet.addRow([
          inst.nombre,
          inst.jefesDirectos,
          inst.banco,
          inst.clabe,
          inst.destajoAcumulado || 0,
          inst.nominaSemanal || 0,
          inst.saldoAnterior || 0,
          inst.anticiposEnCorte || 0, // H: Anticipos otorgados
          inst.anticiposAplicadosManualmente || 0, // I: Anticipos aplicados manualmente (descuentos)
           // J: Destajo a Depositar = MAX(E + H - F - G - I, 0) (Destajo + Anticipos Otorgados - Salario - Saldo Anterior - Aplicados)
           { formula: `MAX(E${rowNum}+H${rowNum}-F${rowNum}-G${rowNum}-I${rowNum},0)` },
          { formula: `FLOOR(J${rowNum},50)` },
           { formula: `MAX(F${rowNum}+G${rowNum}+I${rowNum}-E${rowNum}-H${rowNum},0)` },
          inst.saldoAcumuladoTotal || 0,
        ]);
        row.alignment = { vertical: 'middle' };
      });

      // Add total row with SUM formulas
      const dataEndRow = dataStartRow + instaladores.length - 1;
      const totalRowNum = dataEndRow + 1;
      
      // Add total row with SUM formulas (updated for 12 columns)
      const totalRow = sheet.addRow([
        '',
        '',
        '',
        'TOTAL',
        { formula: `SUM(E${dataStartRow}:E${dataEndRow})` },
        { formula: `SUM(F${dataStartRow}:F${dataEndRow})` },
        { formula: `SUM(G${dataStartRow}:G${dataEndRow})` },
        { formula: `SUM(H${dataStartRow}:H${dataEndRow})` },
        { formula: `SUM(I${dataStartRow}:I${dataEndRow})` },
        { formula: `SUM(J${dataStartRow}:J${dataEndRow})` },
        { formula: `SUM(K${dataStartRow}:K${dataEndRow})` },
        { formula: `SUM(L${dataStartRow}:L${dataEndRow})` },
        { formula: `SUM(M${dataStartRow}:M${dataEndRow})` },
      ]);
      totalRow.font = { bold: true };
      totalRow.alignment = { vertical: 'middle' };

      const numCols = [5, 6, 7, 8, 9, 10, 11, 12, 13]; // E through M
      numCols.forEach((colNum) => {
        sheet.getColumn(colNum).numFmt = '#,##0.00';
        sheet.getColumn(colNum).alignment = { horizontal: 'right', vertical: 'middle' };
      });

      // Format CLABE as text
      sheet.getColumn(4).alignment = { horizontal: 'left', vertical: 'middle' };

      // =====================================================
      // HOJA 2: Resumen Depósitos (solo instaladores con monto > 0)
      // =====================================================
      const sheetResumen = workbook.addWorksheet('Resumen Depósitos');

      // Filter installers with deposits > 0
      const instaladoresConDeposito = instaladores.filter(inst => inst.aDepositar > 0);

      // Title
      sheetResumen.mergeCells('A1:D1');
      const titleResumen = sheetResumen.getCell('A1');
      titleResumen.value = `RESUMEN DEPÓSITOS SEMANA ${weekNum}`;
      titleResumen.font = { bold: true, size: 12 };
      titleResumen.alignment = { horizontal: 'center', vertical: 'middle' };
      sheetResumen.getRow(1).height = 25;

      // Empty row
      sheetResumen.addRow([]);

      // Headers
      const headersResumen = ['NOMBRE DEL TRABAJADOR', 'BANCO', 'CLABE', 'A DEPOSITAR'];
      const headerRowResumen = sheetResumen.addRow(headersResumen);
      headerRowResumen.font = { bold: true };
      headerRowResumen.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRowResumen.height = 25;

      // Column widths
      sheetResumen.columns = [
        { width: 35 }, // Nombre
        { width: 15 }, // Banco
        { width: 22 }, // CLABE
        { width: 16 }, // A Depositar
      ];

      // Data rows
      instaladoresConDeposito.forEach((inst) => {
        const row = sheetResumen.addRow([
          inst.nombre,
          inst.banco,
          inst.clabe,
          inst.aDepositar,
        ]);
        row.alignment = { vertical: 'middle' };
      });

      // Total row
      const resumenDataStart = 4;
      const resumenDataEnd = resumenDataStart + instaladoresConDeposito.length - 1;
      const totalRowNumResumen = resumenDataEnd + 1;
      
      const totalRowResumen = sheetResumen.addRow([
        '',
        '',
        'TOTAL',
        { formula: `SUM(D${resumenDataStart}:D${resumenDataEnd})` },
      ]);
      totalRowResumen.font = { bold: true };
      totalRowResumen.alignment = { vertical: 'middle' };

      // SUB TOTAL FACTURA = TOTAL / 1.06
      const subTotalRowNum = totalRowNumResumen + 1;
      const subTotalRow = sheetResumen.addRow([
        '',
        '',
        'SUB TOTAL FACTURA',
        { formula: `D${totalRowNumResumen}/1.06` },
      ]);
      subTotalRow.font = { bold: true };
      subTotalRow.alignment = { vertical: 'middle' };

      // IVA FACTURA = SUB TOTAL * 0.16
      const ivaRowNum = subTotalRowNum + 1;
      const ivaRow = sheetResumen.addRow([
        '',
        '',
        'IVA FACTURA',
        { formula: `D${subTotalRowNum}*0.16` },
      ]);
      ivaRow.font = { bold: true };
      ivaRow.alignment = { vertical: 'middle' };

      // TOTAL FACTURA = SUB TOTAL + IVA
      const totalFacturaRow = sheetResumen.addRow([
        '',
        '',
        'TOTAL FACTURA',
        { formula: `D${subTotalRowNum}+D${ivaRowNum}` },
      ]);
      totalFacturaRow.font = { bold: true };
      totalFacturaRow.alignment = { vertical: 'middle' };

      // Format currency column
      sheetResumen.getColumn(4).numFmt = '#,##0.00';
      sheetResumen.getColumn(4).alignment = { horizontal: 'right', vertical: 'middle' };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create blob and download
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const sanitizedName = corte.nombre
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .toUpperCase();
      link.download = `RELACION_DE_PAGO_EN_EFECTIVO_INSTALADORES_${sanitizedName}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      return { success: false, error };
    }
  };

  return { exportCorteToExcel };
};
