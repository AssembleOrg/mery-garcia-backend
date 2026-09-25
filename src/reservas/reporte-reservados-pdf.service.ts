import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { FilaReservado, ReporteReservados } from './reporte-reservados.service';
import type { Coincidencia } from './servicio-tokens';
import { fechaDMY } from '../common/utils/fechas';

const NEGRO = rgb(0.29, 0.21, 0.25);
const GRIS = rgb(0.42, 0.36, 0.4);
const GRIS_CLARO = rgb(0.6, 0.6, 0.6);
const LINEA = rgb(0.9, 0.85, 0.87);
const ROSA = rgb(0.83, 0.55, 0.62);

const COLOR_ESTADO: Record<string, ReturnType<typeof rgb>> = {
  COINCIDE: rgb(0.15, 0.55, 0.32),
  PARCIAL: rgb(0.78, 0.5, 0.12),
  DISTINTO: rgb(0.78, 0.2, 0.28),
  INDETERMINADO: GRIS_CLARO,
  SIN_USAR: GRIS_CLARO,
};

const ETIQUETA_ESTADO: Record<string, string> = {
  COINCIDE: 'Coincide',
  PARCIAL: 'Parcial',
  DISTINTO: 'Se hizo otro',
  INDETERMINADO: 'A revisar',
  SIN_USAR: 'Sin usar',
};

/** \"2026-09-15\" → \"15/09/2026\" */
function fechaLarga(iso: string): string {
  return fechaDMY(iso);
}
function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
function estadoDe(f: FilaReservado): string {
  return f.estadoUso === 'SIN_USAR' ? 'SIN_USAR' : (f.coincidencia ?? 'INDETERMINADO');
}

@Injectable()
export class ReporteReservadosPdfService {
  async generar(reporte: ReporteReservados): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fuente = await doc.embedFont(StandardFonts.Helvetica);
    const negrita = await doc.embedFont(StandardFonts.HelveticaBold);

    const ancho = 841.89; // A4 horizontal (la tabla es ancha)
    const alto = 595.28;
    const margen = 40;
    let page = doc.addPage([ancho, alto]);
    let y = alto - margen;

    page.drawText('Reservas: lo reservado vs lo que se hizo', {
      x: margen, y: y - 4, size: 16, font: negrita, color: NEGRO,
    });
    y -= 22;
    page.drawText(`Del ${fechaLarga(reporte.fechaDesde)} al ${fechaLarga(reporte.fechaHasta)}`, {
      x: margen, y, size: 10, font: fuente, color: GRIS,
    });
    y -= 18;
    const r = reporte.resumen;
    page.drawText(
      `${r.total} reservas · coinciden ${r.coincide} · se hizo otro ${r.distinto} · parcial ${r.parcial} · sin usar ${r.sinUsar} · a revisar ${r.indeterminado}`,
      { x: margen, y, size: 9, font: fuente, color: GRIS },
    );
    y -= 22;

    // Columnas
    const cx = {
      fecha: margen,
      clienta: margen + 55,
      reservo: margen + 210,
      hizo: margen + 470,
      estado: ancho - margen - 80,
    };
    const cabecera = (yy: number) => {
      page.drawText('Turno', { x: cx.fecha, y: yy, size: 8, font: negrita, color: GRIS });
      page.drawText('Clienta', { x: cx.clienta, y: yy, size: 8, font: negrita, color: GRIS });
      page.drawText('Reservó', { x: cx.reservo, y: yy, size: 8, font: negrita, color: GRIS });
      page.drawText('Se hizo', { x: cx.hizo, y: yy, size: 8, font: negrita, color: GRIS });
      page.drawText('Estado', { x: cx.estado, y: yy, size: 8, font: negrita, color: GRIS });
    };
    cabecera(y);
    y -= 4;
    page.drawLine({ start: { x: margen, y }, end: { x: ancho - margen, y }, thickness: 0.5, color: LINEA });
    y -= 12;

    if (reporte.filas.length === 0) {
      page.drawText('No hay reservas para mostrar en este período.', {
        x: margen, y, size: 10, font: fuente, color: GRIS,
      });
    }

    for (const f of reporte.filas) {
      if (y - 16 < margen + 20) {
        page = doc.addPage([ancho, alto]);
        y = alto - margen;
        cabecera(y); y -= 16;
      }
      const est = estadoDe(f);
      page.drawText(fechaCorta(f.fechaTurno), { x: cx.fecha, y, size: 8, font: fuente, color: NEGRO });
      page.drawText(recortar(f.clienta, fuente, 8, cx.reservo - cx.clienta - 6), {
        x: cx.clienta, y, size: 8, font: fuente, color: NEGRO,
      });
      page.drawText(recortar(f.servicioReservado, fuente, 8, cx.hizo - cx.reservo - 6), {
        x: cx.reservo, y, size: 8, font: fuente, color: NEGRO,
      });
      const hizo = f.estadoUso === 'SIN_USAR' ? '—' : f.serviciosTomados.join(', ') || '—';
      page.drawText(recortar(hizo, fuente, 8, cx.estado - cx.hizo - 6), {
        x: cx.hizo, y, size: 8, font: fuente, color: est === 'DISTINTO' ? COLOR_ESTADO.DISTINTO : NEGRO,
      });
      page.drawText(ETIQUETA_ESTADO[est], { x: cx.estado, y, size: 8, font: negrita, color: COLOR_ESTADO[est] });
      y -= 15;
    }

    const total = doc.getPageCount();
    for (let i = 0; i < total; i++) {
      doc.getPage(i).drawText(`Página ${i + 1} de ${total}`, {
        x: ancho - margen - 70, y: margen - 22, size: 8, font: fuente, color: GRIS_CLARO,
      });
    }
    // Barra de color de marca arriba
    doc.getPage(0).drawRectangle({ x: 0, y: alto - 4, width: ancho, height: 4, color: ROSA });

    return doc.save();
  }
}

function recortar(texto: string, font: PDFFont, size: number, maxAncho: number): string {
  if (font.widthOfTextAtSize(texto, size) <= maxAncho) return texto;
  let t = texto;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxAncho) t = t.slice(0, -1);
  return t + '…';
}
