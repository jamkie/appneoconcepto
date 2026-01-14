import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import type { CorteSemanal } from '../types';

interface InstaladorPago {
  nombre: string;
  banco: string;
  clabe: string;
  nominaSemanal: number;
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
          instaladores(id, nombre, nombre_banco, numero_cuenta, salario_semanal)
        `)
        .eq('corte_id', corte.id);

      if (solError) throw solError;

      // Group by instalador and sum totals
      const instaladorMap: Record<string, InstaladorPago> = {};
      
      (solicitudes || []).forEach((sol: any) => {
        const instalador = sol.instaladores;
        if (!instalador) return;
        
        if (!instaladorMap[instalador.id]) {
          instaladorMap[instalador.id] = {
            nombre: instalador.nombre?.toUpperCase() || 'SIN NOMBRE',
            banco: instalador.nombre_banco?.toUpperCase() || '',
            clabe: instalador.numero_cuenta || '',
            nominaSemanal: instalador.salario_semanal || 0,
          };
        }
      });

      const instaladores = Object.values(instaladorMap).sort((a, b) => 
        a.nombre.localeCompare(b.nombre)
      );

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.created = new Date();
      
      const sheet = workbook.addWorksheet('Relación de Pago');

      // Define columns
      sheet.columns = [
        { header: 'NOMBRE DEL TRABAJADOR', key: 'nombre', width: 35 },
        { header: 'BANCO', key: 'banco', width: 15 },
        { header: 'CLABE', key: 'clabe', width: 22 },
        { header: 'NOMINA SEMANAL', key: 'nominaSemanal', width: 18 },
      ];

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 20;
      
      // Add data rows
      instaladores.forEach((inst) => {
        sheet.addRow({
          nombre: inst.nombre,
          banco: inst.banco,
          clabe: inst.clabe,
          nominaSemanal: inst.nominaSemanal,
        });
      });

      // Calculate total
      const total = instaladores.reduce((sum, inst) => sum + inst.nominaSemanal, 0);

      // Add total row
      const totalRow = sheet.addRow({
        nombre: '',
        banco: '',
        clabe: 'TOTAL',
        nominaSemanal: total,
      });
      totalRow.font = { bold: true };

      // Format currency column
      sheet.getColumn('nominaSemanal').numFmt = '#,##0.00';
      sheet.getColumn('nominaSemanal').alignment = { horizontal: 'right' };

      // Format CLABE column as text to preserve leading zeros
      sheet.getColumn('clabe').alignment = { horizontal: 'left' };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create blob and download
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename from corte name
      const sanitizedName = corte.nombre
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .toUpperCase();
      link.download = `RELACION_DE_PAGO_${sanitizedName}.xlsx`;
      
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
