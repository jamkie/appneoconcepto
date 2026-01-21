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
  destajoADepositar: number;
  aDepositar: number;
  saldoAFavor: number;
}

export const useExportCorteExcel = () => {
  const exportCorteToExcel = async (corte: CorteSemanal) => {
    try {
      // Fetch all active instaladores
      const { data: allInstaladores, error: instError } = await supabase
        .from('instaladores')
        .select('id, nombre, nombre_banco, numero_cuenta, salario_semanal')
        .eq('activo', true)
        .order('nombre');
      
      if (instError) throw instError;
      
      // Fetch solicitudes for this corte with instalador details
      const { data: solicitudes, error: solError } = await supabase
        .from('solicitudes_pago')
        .select(`
          total_solicitado,
          instalador_id,
          solicitado_por
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
      
      if (corte.estado === 'cerrado') {
        // Use historical data from corte_instaladores
        const { data: ciData } = await supabase
          .from('corte_instaladores')
          .select('*')
          .eq('corte_id', corte.id);
        
        (ciData || []).forEach((ci: any) => {
          corteInstaladoresMap[ci.instalador_id] = ci;
        });
      } else {
        // Use current saldos
        const { data: saldosData } = await supabase
          .from('saldos_instaladores')
          .select('instalador_id, saldo_acumulado');
        
        (saldosData || []).forEach((s: any) => {
          saldosMap[s.instalador_id] = Number(s.saldo_acumulado) || 0;
        });
      }

      // Build instalador map with all active instaladores
      const instaladorMap: Record<string, InstaladorPago & { jefes: Set<string> }> = {};
      
      // Initialize all active instaladores
      (allInstaladores || []).forEach((inst: any) => {
        instaladorMap[inst.id] = {
          nombre: inst.nombre?.toUpperCase() || 'SIN NOMBRE',
          jefesDirectos: '',
          banco: inst.nombre_banco?.toUpperCase() || '',
          clabe: inst.numero_cuenta || '',
          destajoAcumulado: 0,
          nominaSemanal: inst.salario_semanal || 0,
          saldoAnterior: saldosMap[inst.id] || 0,
          destajoADepositar: 0,
          aDepositar: 0,
          saldoAFavor: 0,
          jefes: new Set(),
        };
      });
      
      // Add solicitudes data
      (solicitudes || []).forEach((sol: any) => {
        if (instaladorMap[sol.instalador_id]) {
          instaladorMap[sol.instalador_id].destajoAcumulado += Number(sol.total_solicitado) || 0;
          
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
          // Use historical data
          const ci = corteInstaladoresMap[instId];
          inst.destajoAcumulado = Number(ci.destajo_acumulado);
          inst.saldoAnterior = Number(ci.saldo_anterior);
          inst.aDepositar = Number(ci.monto_depositado);
          inst.saldoAFavor = Number(ci.saldo_generado);
          inst.destajoADepositar = Math.max(0, inst.destajoAcumulado - inst.nominaSemanal + inst.saldoAnterior);
        } else {
          // Calculate in real-time
          const basePago = inst.destajoAcumulado - inst.nominaSemanal + inst.saldoAnterior;
          
          if (basePago >= 0) {
            inst.destajoADepositar = basePago;
            inst.aDepositar = Math.floor(basePago / 50) * 50;
            inst.saldoAFavor = basePago - inst.aDepositar;
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
      sheet.mergeCells('A1:J1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `PAGO SEMANAL INSTALADORES SEMANA ${weekNum} DEL ${fechaInicio} AL ${fechaFin}`;
      titleCell.font = { bold: true, size: 12 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 25;

      // Empty row
      sheet.addRow([]);

      // Define headers (added SALDO ANTERIOR)
      const headers = [
        'NOMBRE DEL TRABAJADOR',
        'JEFES DIRECTOS',
        'BANCO',
        'CLABE',
        'DESTAJO ACUMULADO',
        'NOMINA SEMANAL',
        'SALDO ANTERIOR',
        'DESTAJO A DEPOSITAR',
        'A DEPOSITAR',
        'SALDO A FAVOR',
      ];
      
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 30;

      // Set column widths (updated for 10 columns)
      sheet.columns = [
        { width: 35 }, // A: Nombre
        { width: 15 }, // B: Jefes
        { width: 14 }, // C: Banco
        { width: 20 }, // D: CLABE
        { width: 18 }, // E: Destajo Acumulado
        { width: 16 }, // F: Nomina Semanal
        { width: 16 }, // G: Saldo Anterior
        { width: 20 }, // H: Destajo a Depositar
        { width: 14 }, // I: A Depositar
        { width: 14 }, // J: Saldo a Favor
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
          // H: Destajo a Depositar = MAX(E - F + G, 0)
          { formula: `MAX(E${rowNum}-F${rowNum}+G${rowNum},0)` },
          // I: A Depositar = FLOOR(H, 50)
          { formula: `FLOOR(H${rowNum},50)` },
          // J: Saldo a Favor = H - I (positive = residual, negative would be absorbed but formula handles it)
          { formula: `H${rowNum}-I${rowNum}` },
        ]);
        row.alignment = { vertical: 'middle' };
      });

      // Add total row with SUM formulas
      const dataEndRow = dataStartRow + instaladores.length - 1;
      const totalRowNum = dataEndRow + 1;
      
      // Add total row with SUM formulas (updated for 10 columns)
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
      ]);
      totalRow.font = { bold: true };
      totalRow.alignment = { vertical: 'middle' };

      // Format number columns (updated: E, F, G, H, I, J are now columns 5-10)
      const numCols = [5, 6, 7, 8, 9, 10]; // E, F, G, H, I, J
      numCols.forEach((colNum) => {
        sheet.getColumn(colNum).numFmt = '#,##0.00';
        sheet.getColumn(colNum).alignment = { horizontal: 'right', vertical: 'middle' };
      });

      // Format CLABE as text
      sheet.getColumn(4).alignment = { horizontal: 'left', vertical: 'middle' };

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
