import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import type { CorteSemanal, PaymentMethod } from '../types';
import logoImg from '@/assets/logo-neoconcepto.jpg';

interface PagoForBatch {
  id: string;
  fecha: string;
  monto: number;
  metodo_pago: PaymentMethod;
  referencia: string | null;
  observaciones: string | null;
  obras: { nombre: string } | null;
  instaladores: { 
    nombre: string; 
    numero_cuenta: string | null;
    nombre_banco: string | null;
  } | null;
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

export const useGenerateBatchPDF = () => {
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

  const generatePageForPago = async (
    doc: jsPDF, 
    pago: PagoForBatch, 
    logoBase64: string,
    isFirstPage: boolean
  ) => {
    if (!isFirstPage) {
      doc.addPage();
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Colors (NeoConcepto palette)
    const primaryColor: [number, number, number] = [76, 107, 125];
    const darkColor: [number, number, number] = [51, 68, 79];
    const lightGray: [number, number, number] = [245, 247, 248];
    const textColor: [number, number, number] = [51, 63, 72];

    // Header background
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo
    try {
      doc.addImage(logoBase64, 'JPEG', margin, 8, 45, 28);
    } catch (e) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('NEOCONCEPTO', margin, 25);
    }

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROBANTE DE PAGO', pageWidth - margin, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Folio: ${pago.id.slice(0, 8).toUpperCase()}`, pageWidth - margin, 32, { align: 'right' });

    yPos = 55;

    // Date badge
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 12, 3, 3, 'F');
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Fecha de emisión: ${format(new Date(pago.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
      pageWidth / 2,
      yPos + 7.5,
      { align: 'center' }
    );

    yPos = 75;

    // Amount box
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 35, 4, 4, 'FD');
    
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('MONTO DEL PAGO', pageWidth / 2, yPos + 12, { align: 'center' });
    
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(Number(pago.monto)), pageWidth / 2, yPos + 26, { align: 'center' });

    yPos = 120;

    // Section helper
    const drawSection = (title: string, startY: number): number => {
      doc.setFillColor(...primaryColor);
      doc.rect(margin, startY, pageWidth - margin * 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 5, startY + 5.5);
      return startY + 8;
    };

    const drawField = (label: string, value: string, x: number, y: number) => {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x, y);
      
      doc.setTextColor(...textColor);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x, y + 5);
    };

    // Instalador section
    yPos = drawSection('DATOS DEL INSTALADOR', yPos);
    yPos += 8;
    
    const halfWidth = (pageWidth - margin * 2 - 10) / 2;
    drawField('Nombre', pago.instaladores?.nombre || 'N/A', margin, yPos);
    drawField('Banco', pago.instaladores?.nombre_banco || 'No especificado', margin + halfWidth + 10, yPos);
    
    yPos += 18;
    drawField('Número de Cuenta / CLABE', pago.instaladores?.numero_cuenta || 'No registrado', margin, yPos);
    
    yPos += 25;

    // Payment details section
    yPos = drawSection('INFORMACIÓN DEL PAGO', yPos);
    yPos += 8;
    
    drawField('Fecha del Pago', format(new Date(pago.fecha), "dd/MM/yyyy", { locale: es }), margin, yPos);
    drawField('Método de Pago', paymentMethodLabels[pago.metodo_pago], margin + halfWidth + 10, yPos);
    
    yPos += 18;
    drawField('Obra / Proyecto', pago.obras?.nombre || 'N/A', margin, yPos);
    if (pago.referencia) {
      drawField('Referencia', pago.referencia, margin + halfWidth + 10, yPos);
    }

    yPos += 25;

    // Observations section
    if (pago.observaciones) {
      yPos = drawSection('OBSERVACIONES', yPos);
      yPos += 8;
      
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 2, 2, 'F');
      
      doc.setTextColor(...textColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitText = doc.splitTextToSize(pago.observaciones, pageWidth - margin * 2 - 10);
      doc.text(splitText, margin + 5, yPos + 7);
      
      yPos += 25;
    }

    // Signature area
    yPos = Math.max(yPos + 10, pageHeight - 70);
    
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    
    const sigWidth = 70;
    const sigY = yPos + 15;
    
    doc.line(margin + 10, sigY, margin + 10 + sigWidth, sigY);
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Firma del Instalador', margin + 10 + sigWidth / 2, sigY + 5, { align: 'center' });
    
    doc.line(pageWidth - margin - 10 - sigWidth, sigY, pageWidth - margin - 10, sigY);
    doc.text('Firma del Responsable', pageWidth - margin - 10 - sigWidth / 2, sigY + 5, { align: 'center' });

    // Footer
    doc.setFillColor(...darkColor);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('NeoConcepto • Sistema de Gestión de Destajos', pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.text(
      `Documento generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  };

  const generateBatchPDF = async (corte: CorteSemanal) => {
    // Fetch all pagos for this corte
    const { data: pagos, error } = await supabase
      .from('pagos_destajos')
      .select(`
        id,
        fecha,
        monto,
        metodo_pago,
        referencia,
        observaciones,
        obras(nombre),
        instaladores(nombre, numero_cuenta, nombre_banco)
      `)
      .eq('corte_id', corte.id)
      .order('instaladores(nombre)');

    if (error) throw error;
    if (!pagos || pagos.length === 0) {
      return { success: false, error: 'No hay pagos en este corte' };
    }

    // Load logo once
    let logoBase64 = '';
    try {
      logoBase64 = await loadImageAsBase64(logoImg);
    } catch (e) {
      console.warn('Could not load logo');
    }

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    // Generate a page for each pago
    for (let i = 0; i < pagos.length; i++) {
      await generatePageForPago(doc, pagos[i] as PagoForBatch, logoBase64, i === 0);
    }

    // Save the PDF
    const sanitizedName = corte.nombre
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();
    const filename = `Comprobantes_${sanitizedName}.pdf`;
    doc.save(filename);

    return { success: true, filename, count: pagos.length };
  };

  return { generateBatchPDF };
};
