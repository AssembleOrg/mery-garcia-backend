import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { ReporteServicios, TrabajadoraReporte } from './reporte-servicios.service';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const ROSA = rgb(0.83, 0.55, 0.62);
const ROSA_SUAVE = rgb(0.98, 0.92, 0.94);
const GRIS = rgb(0.42, 0.36, 0.4);
const GRIS_CLARO = rgb(0.6, 0.6, 0.6);
const NEGRO = rgb(0.29, 0.21, 0.25);
const LINEA = rgb(0.9, 0.85, 0.87);

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

function pesos(n: number): string {
  if (!n) return '—';
  return '$ ' + Math.round(n).toLocaleString('es-AR');
}

function dolares(n: number): string {
  if (!n) return '—';
  return 'u$s ' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * PDF del reporte de servicios y señas por trabajadora, para descargar desde
 * la vista de comisiones. Formato pensado para Luna y Rosario, pero sirve para
 * cualquier trabajadora que venga en el reporte.
 */
@Injectable()
export class ReporteServiciosPdfService {
  async generar(reporte: ReporteServicios): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fuente = await doc.embedFont(StandardFonts.Helvetica);
    const negrita = await doc.embedFont(StandardFonts.HelveticaBold);

    const ancho = 595.28; // A4 vertical
    const alto = 841.89;
    const margen = 48;

    let page = doc.addPage([ancho, alto]);
    let y = alto - margen;

    const nuevaPagina = () => {
      page = doc.addPage([ancho, alto]);
      y = alto - margen;
    };
    const espacio = (necesario: number) => {
      if (y - necesario < margen) nuevaPagina();
    };

    // Encabezado
    page.drawText('Servicios y señas por profesional', {
      x: margen, y: y - 6, size: 18, font: negrita, color: NEGRO,
    });
    y -= 26;
    page.drawText(
      `Del ${fechaLarga(reporte.fechaDesde)} al ${fechaLarga(reporte.fechaHasta)}`,
      { x: margen, y, size: 10, font: fuente, color: GRIS },
    );
    y -= 24;

    if (reporte.trabajadoras.length === 0) {
      page.drawText('No hay servicios en el período elegido.', {
        x: margen, y, size: 11, font: fuente, color: GRIS,
      });
    }

    for (const t of reporte.trabajadoras) {
      this.dibujarTrabajadora(t, {
        page, fuente, negrita, margen, ancho,
        getY: () => y, setY: (v) => { y = v; }, espacio, nuevaPagina,
        rePage: () => page,
      });
      y -= 18;
    }

    // Pie
    const total = doc.getPageCount();
    for (let i = 0; i < total; i++) {
      const p = doc.getPage(i);
      p.drawText(`Página ${i + 1} de ${total}`, {
        x: ancho - margen - 70, y: margen - 20, size: 8, font: fuente, color: GRIS_CLARO,
      });
    }

    return doc.save();
  }

  private dibujarTrabajadora(
    t: TrabajadoraReporte,
    ctx: {
      page: PDFPage; fuente: PDFFont; negrita: PDFFont; margen: number; ancho: number;
      getY: () => number; setY: (v: number) => void; espacio: (n: number) => void;
      nuevaPagina: () => void; rePage: () => PDFPage;
    },
  ) {
    const { fuente, negrita, margen, ancho } = ctx;
    const anchoUtil = ancho - margen * 2;

    ctx.espacio(90);
    let page = ctx.rePage();
    let y = ctx.getY();

    // Título de la profesional, con barra rosa
    page.drawRectangle({ x: margen, y: y - 22, width: anchoUtil, height: 26, color: ROSA });
    page.drawText(t.nombre, { x: margen + 10, y: y - 15, size: 13, font: negrita, color: rgb(1, 1, 1) });
    const resumen = `${t.cantidadServicios} servicios · ${t.totalSenasClientas} clientas con seña`;
    page.drawText(resumen, {
      x: ancho - margen - negrita.widthOfTextAtSize(resumen, 9) - 10,
      y: y - 14, size: 9, font: fuente, color: rgb(1, 1, 1),
    });
    y -= 40;

    // ── Servicios ──
    page.drawText('Servicios realizados', { x: margen, y, size: 11, font: negrita, color: NEGRO });
    y -= 16;

    const colCant = margen + 250;
    const colARS = margen + 320;
    const colUSD = ancho - margen;
    const cab = (yy: number) => {
      page.drawText('Servicio', { x: margen, y: yy, size: 8, font: negrita, color: GRIS });
      page.drawText('Cant.', { x: colCant, y: yy, size: 8, font: negrita, color: GRIS });
      dibujarDerecha(page, 'Monto ARS', colARS, yy, 8, negrita, GRIS);
      dibujarDerecha(page, 'Monto USD', colUSD, yy, 8, negrita, GRIS);
    };
    cab(y);
    y -= 4;
    page.drawLine({ start: { x: margen, y }, end: { x: ancho - margen, y }, thickness: 0.5, color: LINEA });
    y -= 12;

    if (t.servicios.length === 0) {
      page.drawText('Sin servicios en el período.', { x: margen, y, size: 9, font: fuente, color: GRIS_CLARO });
      y -= 14;
    }

    for (const s of t.servicios) {
      if (y - 14 < margen) {
        ctx.nuevaPagina();
        page = ctx.rePage();
        y = ctx.getY();
        cab(y); y -= 16;
      }
      page.drawText(recortar(s.nombre, fuente, 9, colCant - margen - 8), {
        x: margen, y, size: 9, font: fuente, color: NEGRO,
      });
      page.drawText(String(s.cantidad), { x: colCant, y, size: 9, font: fuente, color: NEGRO });
      dibujarDerecha(page, pesos(s.montoARS), colARS, y, 9, fuente, NEGRO);
      dibujarDerecha(page, dolares(s.montoUSD), colUSD, y, 9, fuente, NEGRO);
      y -= 14;
    }

    // Total servicios
    y -= 2;
    page.drawLine({ start: { x: margen, y: y + 6 }, end: { x: ancho - margen, y: y + 6 }, thickness: 0.5, color: LINEA });
    page.drawText('Total servicios', { x: margen, y: y - 6, size: 9, font: negrita, color: NEGRO });
    dibujarDerecha(page, pesos(t.totalServiciosARS), colARS, y - 6, 9, negrita, NEGRO);
    dibujarDerecha(page, dolares(t.totalServiciosUSD), colUSD, y - 6, 9, negrita, NEGRO);
    y -= 26;

    // ── Señas por medio de pago ──
    if (y - 60 < margen) { ctx.nuevaPagina(); page = ctx.rePage(); y = ctx.getY(); }

    page.drawText('Señas por medio de pago', { x: margen, y, size: 11, font: negrita, color: NEGRO });
    y -= 16;

    const mCli = margen + 170;
    const mSenas = margen + 240;
    const mARS = margen + 340;
    const mUSD = ancho - margen;
    const cabSenas = (yy: number) => {
      page.drawText('Medio', { x: margen, y: yy, size: 8, font: negrita, color: GRIS });
      dibujarDerecha(page, 'Clientas', mCli, yy, 8, negrita, GRIS);
      dibujarDerecha(page, 'Señas', mSenas, yy, 8, negrita, GRIS);
      dibujarDerecha(page, 'Monto ARS', mARS, yy, 8, negrita, GRIS);
      dibujarDerecha(page, 'Monto USD', mUSD, yy, 8, negrita, GRIS);
    };
    cabSenas(y);
    y -= 4;
    page.drawLine({ start: { x: margen, y }, end: { x: ancho - margen, y }, thickness: 0.5, color: LINEA });
    y -= 12;

    if (t.senasPorMedio.length === 0) {
      page.drawText('Ninguna clienta dejó seña en el período.', { x: margen, y, size: 9, font: fuente, color: GRIS_CLARO });
      y -= 14;
    }

    let filaPar = false;
    for (const m of t.senasPorMedio) {
      if (y - 14 < margen) {
        ctx.nuevaPagina(); page = ctx.rePage(); y = ctx.getY();
        cabSenas(y); y -= 16;
      }
      if (filaPar) {
        page.drawRectangle({ x: margen - 4, y: y - 3, width: anchoUtil + 8, height: 14, color: ROSA_SUAVE });
      }
      filaPar = !filaPar;
      page.drawText(m.label, { x: margen, y, size: 9, font: fuente, color: NEGRO });
      dibujarDerecha(page, String(m.clientas), mCli, y, 9, fuente, NEGRO);
      dibujarDerecha(page, String(m.senas), mSenas, y, 9, fuente, NEGRO);
      dibujarDerecha(page, pesos(m.montoARS), mARS, y, 9, fuente, NEGRO);
      dibujarDerecha(page, dolares(m.montoUSD), mUSD, y, 9, fuente, NEGRO);
      y -= 14;
    }

    y -= 2;
    page.drawLine({ start: { x: margen, y: y + 6 }, end: { x: ancho - margen, y: y + 6 }, thickness: 0.5, color: LINEA });
    page.drawText('Total', { x: margen, y: y - 6, size: 9, font: negrita, color: NEGRO });
    dibujarDerecha(page, String(t.totalSenasClientas), mCli, y - 6, 9, negrita, NEGRO);
    dibujarDerecha(page, String(t.totalSenas), mSenas, y - 6, 9, negrita, NEGRO);
    y -= 20;

    ctx.setY(y);
  }
}

function dibujarDerecha(
  page: PDFPage, texto: string, xDerecha: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(texto, size);
  page.drawText(texto, { x: xDerecha - w, y, size, font, color });
}

function recortar(texto: string, font: PDFFont, size: number, maxAncho: number): string {
  if (font.widthOfTextAtSize(texto, size) <= maxAncho) return texto;
  let t = texto;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxAncho) t = t.slice(0, -1);
  return t + '…';
}
