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
  destajoADepositar: number;
  aDepositar: number;
  saldoAFavor: number;
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
          obra_id,
          instaladores(id, nombre, nombre_banco, numero_cuenta, salario_semanal)
        `)
        .eq('corte_id', corte.id);

      if (solError) throw solError;

      // Fetch obra supervisors for "jefes directos"
      const obraIds = [...new Set((solicitudes || []).map((s: any) => s.obra_id))];
      
      const { data: supervisoresData } = await supabase
        .from('obra_supervisores')
        .select(`
          obra_id,
          supervisor_id,
          profiles:supervisor_id(full_name)
        `)
        .in('obra_id', obraIds);

      // Create a map of obra_id -> supervisor names
      const obraSupervisores: Record<string, string[]> = {};
      (supervisoresData || []).forEach((os: any) => {
        if (!obraSupervisores[os.obra_id]) {
          obraSupervisores[os.obra_id] = [];
        }
        const name = os.profiles?.full_name?.split(' ')[0]?.toUpperCase() || '';
        if (name && !obraSupervisores[os.obra_id].includes(name)) {
          obraSupervisores[os.obra_id].push(name);
        }
      });

      // Group by instalador and sum totals
      const instaladorMap: Record<string, InstaladorPago & { obraIds: string[] }> = {};
      
      (solicitudes || []).forEach((sol: any) => {
        const instalador = sol.instaladores;
        if (!instalador) return;
        
        if (!instaladorMap[instalador.id]) {
          instaladorMap[instalador.id] = {
            nombre: instalador.nombre?.toUpperCase() || 'SIN NOMBRE',
            jefesDirectos: '',
            banco: instalador.nombre_banco?.toUpperCase() || '',
            clabe: instalador.numero_cuenta || '',
            destajoAcumulado: 0,
            nominaSemanal: instalador.salario_semanal || 0,
            destajoADepositar: 0,
            aDepositar: 0,
            saldoAFavor: 0,
            obraIds: [],
          };
        }
        
        instaladorMap[instalador.id].destajoAcumulado += Number(sol.total_solicitado) || 0;
        if (!instaladorMap[instalador.id].obraIds.includes(sol.obra_id)) {
          instaladorMap[instalador.id].obraIds.push(sol.obra_id);
        }
      });

      // Calculate derived fields and get jefes directos
      Object.values(instaladorMap).forEach((inst) => {
        // Get unique supervisors from all obras this installer worked on
        const supervisors = new Set<string>();
        inst.obraIds.forEach((obraId) => {
          (obraSupervisores[obraId] || []).forEach((s) => supervisors.add(s));
        });
        inst.jefesDirectos = Array.from(supervisors).join(' ');

        // Destajo a depositar = Destajo Acumulado - Nomina Semanal
        const destajoADepositar = inst.destajoAcumulado - inst.nominaSemanal;
        inst.destajoADepositar = destajoADepositar > 0 ? destajoADepositar : 0;
        
        // A depositar = redondeado a decenas inferiores
        inst.aDepositar = inst.destajoADepositar > 0 
          ? Math.floor(inst.destajoADepositar / 50) * 50 
          : 0;
        
        // Saldo a favor = diferencia (si hay)
        inst.saldoAFavor = inst.destajoADepositar - inst.aDepositar;
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
      sheet.mergeCells('A1:I1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `PAGO SEMANAL INSTALADORES SEMANA ${weekNum} DEL ${fechaInicio} AL ${fechaFin}`;
      titleCell.font = { bold: true, size: 12 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 25;

      // Empty row
      sheet.addRow([]);

      // Define headers
      const headers = [
        'NOMBRE DEL TRABAJADOR',
        'JEFES DIRECTOS',
        'BANCO',
        'CLABE',
        'DESTAJO ACUMULADO',
        'NOMINA SEMANAL',
        'DESTAJO A DEPOSITAR',
        'A DEPOSITAR',
        'SALDO A FAVOR',
      ];
      
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 30;

      // Set column widths
      sheet.columns = [
        { width: 35 }, // Nombre
        { width: 15 }, // Jefes
        { width: 14 }, // Banco
        { width: 20 }, // CLABE
        { width: 18 }, // Destajo Acumulado
        { width: 16 }, // Nomina Semanal
        { width: 20 }, // Destajo a Depositar
        { width: 14 }, // A Depositar
        { width: 14 }, // Saldo a Favor
      ];

      // Add data rows
      instaladores.forEach((inst) => {
        const row = sheet.addRow([
          inst.nombre,
          inst.jefesDirectos,
          inst.banco,
          inst.clabe,
          inst.destajoAcumulado || '',
          inst.nominaSemanal || '',
          inst.destajoADepositar > 0 ? inst.destajoADepositar : (inst.destajoAcumulado > 0 ? '-' : ''),
          inst.aDepositar || '',
          inst.saldoAFavor || '',
        ]);
        row.alignment = { vertical: 'middle' };
      });

      // Calculate totals
      const totals = {
        destajoAcumulado: instaladores.reduce((sum, i) => sum + (i.destajoAcumulado || 0), 0),
        nominaSemanal: instaladores.reduce((sum, i) => sum + (i.nominaSemanal || 0), 0),
        destajoADepositar: instaladores.reduce((sum, i) => sum + (i.destajoADepositar || 0), 0),
        aDepositar: instaladores.reduce((sum, i) => sum + (i.aDepositar || 0), 0),
        saldoAFavor: instaladores.reduce((sum, i) => sum + (i.saldoAFavor || 0), 0),
      };

      // Add total row
      const totalRow = sheet.addRow([
        '',
        '',
        '',
        'TOTAL',
        totals.destajoAcumulado,
        totals.nominaSemanal,
        totals.destajoADepositar,
        totals.aDepositar,
        '',
      ]);
      totalRow.font = { bold: true };
      totalRow.alignment = { vertical: 'middle' };

      // Format number columns
      const numCols = [5, 6, 7, 8, 9]; // E, F, G, H, I
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
