import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import logoImg from '@/assets/logo-neoconcepto.jpg';

interface ObraItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

interface ObraExtra {
  id: string;
  descripcion: string;
  monto: number;
  estado: string;
}

interface ObraPago {
  id: string;
  fecha: string;
  monto: number;
  metodo_pago: string;
  instalador_nombre: string;
}

interface ObraForPDF {
  id: string;
  nombre: string;
  cliente?: string | null;
  responsable?: string | null;
  estado: string;
  descuento?: number;
  items: ObraItem[];
  extras: ObraExtra[];
  pagos: ObraPago[];
  avances: Record<string, number>;
  totalExtras: number;
  totalPagado: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

export const useGenerateEstadoCuentaPDF = () => {
  const loadImageAsBase64 = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg'));
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  const generatePDF = async (obra: ObraForPDF) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Colors (NeoConcepto palette)
    const primaryColor: [number, number, number] = [76, 107, 125];
    const darkColor: [number, number, number] = [51, 68, 79];
    const lightGray: [number, number, number] = [245, 247, 248];
    const textColor: [number, number, number] = [51, 63, 72];
    const accentGreen: [number, number, number] = [16, 185, 129];
    const accentRed: [number, number, number] = [239, 68, 68];

    // Calculations
    const totalItems = obra.items.reduce((sum, pieza) => sum + pieza.cantidad * pieza.precio_unitario, 0);
    const extrasAprobados = obra.extras.filter((e) => e.estado === 'aprobado');
    const subtotal = totalItems + obra.totalExtras;
    const descuento = obra.descuento || 0;
    const montoDescuento = subtotal * (descuento / 100);
    const total = subtotal - montoDescuento;
    const porPagar = total - obra.totalPagado;

    // Header background
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 42, 'F');

    // Logo
    try {
      const logoBase64 = await loadImageAsBase64(logoImg);
      doc.addImage(logoBase64, 'JPEG', margin, 6, 40, 25);
    } catch (e) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('NEOCONCEPTO', margin, 22);
    }

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTADO DE CUENTA', pageWidth - margin, 18, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Folio: ${obra.id.slice(0, 8).toUpperCase()}`, pageWidth - margin, 28, { align: 'right' });
    doc.text(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es }), pageWidth - margin, 35, { align: 'right' });

    yPos = 50;

    // Project info card
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 28, 3, 3, 'F');

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('OBRA', margin + 5, yPos + 7);
    doc.text('CLIENTE', margin + 90, yPos + 7);

    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(obra.nombre, margin + 5, yPos + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(obra.cliente || 'Sin especificar', margin + 90, yPos + 14);

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.text('RESPONSABLE', margin + 5, yPos + 21);
    doc.text('ESTADO', margin + 90, yPos + 21);

    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.text(obra.responsable || '-', margin + 5, yPos + 26);

    // Status badge
    const statusText = obra.estado === 'activa' ? 'En Proceso' : 'Concluida';
    const statusColor = obra.estado === 'activa' ? accentGreen : primaryColor;
    doc.setTextColor(...statusColor);
    doc.setFont('helvetica', 'bold');
    doc.text(statusText, margin + 90, yPos + 26);

    yPos = 85;

    // Section helper
    const drawSectionHeader = (title: string, y: number): number => {
      doc.setFillColor(...primaryColor);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 4, y + 5);
      return y + 7;
    };

    // Table header helper
    const drawTableHeader = (headers: { text: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[], y: number): number => {
      doc.setFillColor(230, 235, 240);
      doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      headers.forEach(h => {
        doc.text(h.text, h.x, y + 4, { align: h.align || 'left' });
      });
      return y + 6;
    };

    // PIEZAS section
    yPos = drawSectionHeader('DETALLE DE PIEZAS', yPos);
    yPos = drawTableHeader([
      { text: 'DESCRIPCIÓN', x: margin + 4, width: 70 },
      { text: 'AVANCE', x: margin + 85, width: 25, align: 'center' },
      { text: 'P. UNIT.', x: margin + 115, width: 30, align: 'right' },
      { text: 'SUBTOTAL', x: pageWidth - margin - 4, width: 30, align: 'right' },
    ], yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    obra.items.forEach((pieza, index) => {
      const completado = obra.avances[pieza.id] || 0;
      const itemSubtotal = pieza.cantidad * pieza.precio_unitario;
      const rowY = yPos + 5;

      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(250, 251, 252);
        doc.rect(margin, yPos, pageWidth - margin * 2, 6, 'F');
      }

      doc.setTextColor(...textColor);
      doc.text(pieza.descripcion.substring(0, 40), margin + 4, rowY);

      // Progress indicator
      const progressPercent = pieza.cantidad > 0 ? (completado / pieza.cantidad) * 100 : 0;
      const progressText = `${completado}/${pieza.cantidad}`;
      doc.setTextColor(progressPercent >= 100 ? 16 : 107, progressPercent >= 100 ? 185 : 114, progressPercent >= 100 ? 129 : 128);
      doc.text(progressText, margin + 85, rowY, { align: 'center' });

      doc.setTextColor(...textColor);
      doc.text(formatCurrency(pieza.precio_unitario), margin + 115, rowY, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(itemSubtotal), pageWidth - margin - 4, rowY, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      yPos += 6;
    });

    // Subtotal piezas
    doc.setFillColor(230, 235, 240);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal Piezas:', margin + 100, yPos + 5, { align: 'right' });
    doc.text(formatCurrency(totalItems), pageWidth - margin - 4, yPos + 5, { align: 'right' });

    yPos += 12;

    // EXTRAS section (if any)
    if (extrasAprobados.length > 0) {
      yPos = drawSectionHeader('EXTRAS APROBADOS', yPos);
      yPos = drawTableHeader([
        { text: 'DESCRIPCIÓN', x: margin + 4, width: 120 },
        { text: 'MONTO', x: pageWidth - margin - 4, width: 40, align: 'right' },
      ], yPos);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      extrasAprobados.forEach((extra, index) => {
        const rowY = yPos + 5;
        if (index % 2 === 0) {
          doc.setFillColor(250, 251, 252);
          doc.rect(margin, yPos, pageWidth - margin * 2, 6, 'F');
        }
        doc.setTextColor(...textColor);
        doc.text(extra.descripcion.substring(0, 60), margin + 4, rowY);
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(extra.monto), pageWidth - margin - 4, rowY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        yPos += 6;
      });

      // Subtotal extras
      doc.setFillColor(230, 235, 240);
      doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
      doc.setTextColor(...textColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Subtotal Extras:', margin + 100, yPos + 5, { align: 'right' });
      doc.text(formatCurrency(obra.totalExtras), pageWidth - margin - 4, yPos + 5, { align: 'right' });

      yPos += 12;
    }

    // Check if we need a new page for payments
    if (yPos > pageHeight - 100 && obra.pagos.length > 0) {
      doc.addPage();
      yPos = margin;
    }

    // PAGOS section (if any)
    if (obra.pagos.length > 0) {
      yPos = drawSectionHeader('HISTORIAL DE PAGOS', yPos);
      yPos = drawTableHeader([
        { text: 'FECHA', x: margin + 4, width: 25 },
        { text: 'INSTALADOR', x: margin + 35, width: 50 },
        { text: 'MÉTODO', x: margin + 100, width: 30, align: 'center' },
        { text: 'MONTO', x: pageWidth - margin - 4, width: 30, align: 'right' },
      ], yPos);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      obra.pagos.forEach((pago, index) => {
        const rowY = yPos + 5;
        if (index % 2 === 0) {
          doc.setFillColor(250, 251, 252);
          doc.rect(margin, yPos, pageWidth - margin * 2, 6, 'F');
        }
        doc.setTextColor(...textColor);
        doc.text(format(new Date(pago.fecha), 'dd/MM/yyyy'), margin + 4, rowY);
        doc.text(pago.instalador_nombre.substring(0, 25), margin + 35, rowY);
        doc.text(pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1), margin + 100, rowY, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accentGreen);
        doc.text(formatCurrency(pago.monto), pageWidth - margin - 4, rowY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        yPos += 6;
      });

      // Total pagado
      doc.setFillColor(230, 235, 240);
      doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
      doc.setTextColor(...textColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Pagado:', margin + 100, yPos + 5, { align: 'right' });
      doc.setTextColor(...accentGreen);
      doc.text(formatCurrency(obra.totalPagado), pageWidth - margin - 4, yPos + 5, { align: 'right' });

      yPos += 12;
    }

    // Check if we need a new page for summary
    if (yPos > pageHeight - 70) {
      doc.addPage();
      yPos = margin;
    }

    // RESUMEN FINANCIERO section
    yPos = drawSectionHeader('RESUMEN FINANCIERO', yPos);

    const summaryBoxHeight = descuento > 0 ? 50 : 42;
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, summaryBoxHeight, 3, 3, 'F');

    let summaryY = yPos + 10;
    const labelX = margin + 10;
    const valueX = pageWidth - margin - 10;

    const drawSummaryRow = (label: string, value: string, isHighlight = false, color?: [number, number, number]) => {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(label, labelX, summaryY);

      if (color) {
        doc.setTextColor(...color);
      } else {
        doc.setTextColor(...textColor);
      }
      doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
      doc.setFontSize(isHighlight ? 12 : 10);
      doc.text(value, valueX, summaryY, { align: 'right' });
      summaryY += 8;
    };

    drawSummaryRow('Subtotal (Piezas + Extras):', formatCurrency(subtotal));
    if (descuento > 0) {
      drawSummaryRow(`Descuento (${descuento}%):`, `-${formatCurrency(montoDescuento)}`, false, accentRed);
    }
    drawSummaryRow('Total Obra:', formatCurrency(total), true);
    drawSummaryRow('Total Pagado:', formatCurrency(obra.totalPagado), false, accentGreen);

    // Por pagar highlight box
    yPos = summaryY + 5;
    const porPagarColor = porPagar > 0 ? accentRed : accentGreen;
    doc.setFillColor(porPagar > 0 ? 254 : 236, porPagar > 0 ? 242 : 253, porPagar > 0 ? 242 : 245);
    doc.setDrawColor(...porPagarColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin + 60, yPos, pageWidth - margin * 2 - 60, 14, 3, 3, 'FD');

    doc.setTextColor(...porPagarColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SALDO PENDIENTE:', margin + 70, yPos + 9);
    doc.setFontSize(14);
    doc.text(formatCurrency(porPagar), pageWidth - margin - 10, yPos + 9, { align: 'right' });

    // Footer
    doc.setFillColor(...darkColor);
    doc.rect(0, pageHeight - 18, pageWidth, 18, 'F');

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('NeoConcepto • Sistema de Gestión de Destajos', pageWidth / 2, pageHeight - 11, { align: 'center' });
    doc.text(
      `Documento generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );

    // Save the PDF
    const filename = `Estado_Cuenta_${obra.nombre.toLowerCase().replace(/\s+/g, '-')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(filename);

    return { success: true, filename };
  };

  return { generatePDF };
};
