import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ObraExport {
  id: string;
  nombre: string;
  cliente: string;
  responsable: string;
  estado: string;
  descuento: number;
  created_at: string;
  created_by: string | null;
}

export type ExportFilter = 'todas' | 'activas' | 'cerradas';

export const useExportObrasExcel = () => {
  const exportObrasToExcel = async (filter: ExportFilter = 'todas') => {
    try {
      // Fetch obras based on filter
      let query = supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'activas') {
        query = query.eq('estado', 'activa');
      } else if (filter === 'cerradas') {
        query = query.eq('estado', 'cerrada');
      }

      const { data: obrasData, error: obrasError } = await query;

      if (obrasError) throw obrasError;

      // Fetch profiles for creator names
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name');

      const profilesMap: Record<string, string> = {};
      (profilesData || []).forEach((p) => {
        profilesMap[p.id] = p.full_name || 'Sin nombre';
      });

      // Fetch all obra_items
      const { data: itemsData } = await supabase
        .from('obra_items')
        .select('*');

      // Fetch all avance_items to calculate progress
      const { data: avanceItemsData } = await supabase
        .from('avance_items')
        .select('obra_item_id, cantidad_completada');

      // Fetch all pagos_destajos (with corte_id to filter)
      const { data: pagosData } = await supabase
        .from('pagos_destajos')
        .select('obra_id, monto, corte_id');

      // Fetch all anticipos
      const { data: anticiposData } = await supabase
        .from('anticipos')
        .select('obra_id, monto_original');

      // Fetch all extras
      const { data: extrasData } = await supabase
        .from('extras')
        .select('id, obra_id, monto, estado, descuento');

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'NeoConcepto';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Obras');

      // Header styling
      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        },
      };

      // Set columns
      sheet.columns = [
        { header: 'OBRA', key: 'nombre', width: 30 },
        { header: 'CLIENTE', key: 'cliente', width: 25 },
        { header: 'RESPONSABLE', key: 'responsable', width: 20 },
        { header: 'ESTADO', key: 'estado', width: 15 },
        { header: 'FECHA REGISTRO', key: 'fecha_registro', width: 18 },
        { header: 'REGISTRADO POR', key: 'registrado_por', width: 20 },
        { header: 'SUBTOTAL ITEMS', key: 'subtotal_items', width: 18 },
        { header: 'TOTAL EXTRAS', key: 'total_extras', width: 18 },
        { header: 'DESCUENTO %', key: 'descuento', width: 14 },
        { header: 'MONTO TOTAL', key: 'monto_total', width: 18 },
        { header: 'TOTAL PAGADO', key: 'total_pagado', width: 18 },
        { header: 'SALDO PENDIENTE', key: 'saldo_pendiente', width: 18 },
        { header: '% AVANCE', key: 'porcentaje_avance', width: 14 },
      ];

      // Apply header style
      sheet.getRow(1).eachCell((cell) => {
        Object.assign(cell, { style: headerStyle });
      });
      sheet.getRow(1).height = 25;

      // Process each obra
      (obrasData || []).forEach((obra: ObraExport) => {
        const items = (itemsData || []).filter((item) => item.obra_id === obra.id);
        
        // Calculate subtotal items
        const subtotalItems = items.reduce((sum, item) => {
          return sum + (item.cantidad * Number(item.precio_unitario));
        }, 0);

        // Calculate progress per item
        let totalPiezas = 0;
        let totalInstaladas = 0;
        items.forEach((item) => {
          totalPiezas += item.cantidad;
          const itemAvances = (avanceItemsData || [])
            .filter((ai) => ai.obra_item_id === item.id)
            .reduce((sum, ai) => sum + ai.cantidad_completada, 0);
          totalInstaladas += Math.min(itemAvances, item.cantidad);
        });
        const porcentajeAvance = totalPiezas > 0 ? (totalInstaladas / totalPiezas) * 100 : 0;

        // Calculate total pagado (direct payments only, no corte-based)
        const pagosDirectos = (pagosData || [])
          .filter((p) => p.obra_id === obra.id && !p.corte_id)
          .reduce((sum, p) => sum + Number(p.monto), 0);

        // Add anticipos
        const totalAnticipos = (anticiposData || [])
          .filter((a) => a.obra_id === obra.id)
          .reduce((sum, a) => sum + Number(a.monto_original), 0);

        const totalPagado = pagosDirectos + totalAnticipos;

        // Calculate total extras (only aprobados)
        const obraExtras = (extrasData || []).filter((e) => e.obra_id === obra.id && e.estado === 'aprobado');
        const totalExtras = obraExtras.reduce((sum, e) => {
          const montoNeto = Number(e.monto) * (1 - (e.descuento || 0) / 100);
          return sum + montoNeto;
        }, 0);

        // Calculate totals with discount
        const subtotal = subtotalItems + totalExtras;
        const montoDescuento = subtotal * (obra.descuento / 100);
        const montoTotal = subtotal - montoDescuento;
        const saldoPendiente = Math.max(0, montoTotal - totalPagado);

        // Map estado
        const estadoLabel = obra.estado === 'activa' ? 'En Proceso' : 
                           obra.estado === 'cerrada' ? 'Concluida' : obra.estado;

        sheet.addRow({
          nombre: obra.nombre,
          cliente: obra.cliente || '',
          responsable: obra.responsable || '',
          estado: estadoLabel,
          fecha_registro: format(new Date(obra.created_at), 'dd/MM/yyyy', { locale: es }),
          registrado_por: obra.created_by ? profilesMap[obra.created_by] || 'Desconocido' : 'N/A',
          subtotal_items: subtotalItems,
          total_extras: totalExtras,
          descuento: obra.descuento,
          monto_total: montoTotal,
          total_pagado: totalPagado,
          saldo_pendiente: saldoPendiente,
          porcentaje_avance: Math.round(porcentajeAvance),
        });
      });

      // Style data rows
      const currencyColumns = ['subtotal_items', 'total_extras', 'monto_total', 'total_pagado', 'saldo_pendiente'];
      const currencyIndices = [7, 8, 10, 11, 12]; // 1-indexed column positions

      for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          cell.alignment = { vertical: 'middle' };

          // Currency formatting
          if (currencyIndices.includes(colNumber)) {
            cell.numFmt = '"$"#,##0.00';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }

          // Percentage formatting for descuento and avance
          if (colNumber === 9 || colNumber === 13) {
            cell.numFmt = '0"%"';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }

          // Center align estado
          if (colNumber === 4) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        // Alternate row colors
        if (i % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF3F4F6' },
            };
          });
        }
      }

      // Add totals row
      const totalRowNum = sheet.rowCount + 1;
      const totalRow = sheet.addRow({
        nombre: 'TOTALES',
        cliente: '',
        responsable: '',
        estado: '',
        fecha_registro: '',
        registrado_por: '',
        subtotal_items: { formula: `SUM(G2:G${totalRowNum - 1})` },
        total_extras: { formula: `SUM(H2:H${totalRowNum - 1})` },
        descuento: '',
        monto_total: { formula: `SUM(J2:J${totalRowNum - 1})` },
        total_pagado: { formula: `SUM(K2:K${totalRowNum - 1})` },
        saldo_pendiente: { formula: `SUM(L2:L${totalRowNum - 1})` },
        porcentaje_avance: '',
      });

      totalRow.font = { bold: true };
      totalRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' },
        };
        if (currencyIndices.includes(colNumber)) {
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });

      // Generate and download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Obras_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Error exporting obras to Excel:', error);
      throw error;
    }
  };

  return { exportObrasToExcel };
};
