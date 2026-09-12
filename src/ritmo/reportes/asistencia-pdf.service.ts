import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type {
  AsistenciaRitmo,
  EstadoDia,
  FilaAsistencia,
  RevisionDia,
} from '../ritmo.types';

const ESTADO: Record<EstadoDia, string> = {
  TRABAJADO: 'Trabajado',
  INCOMPLETO: 'Incompleto',
  AUSENTE: 'Ausente',
  LICENCIA: 'Licencia',
  SIN_TURNO: 'Sin turno',
};

const REVISION: Record<RevisionDia, string> = {
  VALIDO: 'Justificado',
  PENDIENTE: 'A revisar',
  RECHAZADO: 'Rechazado',
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "2026-09-15" → "15/09" */
function fechaCorta(dia: string): string {
  const [, m, d] = dia.split('-');
  return `${d}/${m}`;
}

/** "2026-09-15" → "Lun". Se parsea a mediodía UTC para no correr de día. */
function nombreDia(dia: string): string {
  return DIAS[new Date(`${dia}T12:00:00Z`).getUTCDay()];
}

/** "2026-09-15" → "15 de septiembre de 2026" */
function fechaLarga(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** 485 → "8h 05m". Los negativos salen con signo. */
function duracion(minutos: number): string {
  if (!minutos) return '—';
  const signo = minutos < 0 ? '-' : '';
  const abs = Math.abs(minutos);
  return `${signo}${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, '0')}m`;
}

function horas(minutos: number): string {
  return `${(minutos / 60).toFixed(1)} h`;
}

/**
 * Arma el PDF del reporte de asistencia.
 *
 * Se agrupa por persona y no como una lista plana: el reporte se lee para
 * responder "cómo viene tal persona", y una tabla corrida de 400 filas no
 * contesta eso. Cada persona cierra con su subtotal.
 */
@Injectable()
export class AsistenciaPdfService {
  private readonly ancho = 841.89; // A4 apaisado
  private readonly alto = 595.28;
  private readonly margen = 30;

  // Columnas, medidas desde el borde izquierdo.
  private readonly col = {
    fecha: 30,
    dia: 78,
    turno: 118,
    entrada: 196,
    salida: 248,
    pausa: 340, // derecha
    trabajado: 412, // derecha
    saldo: 474, // derecha
    tarde: 528, // derecha
    estado: 544,
    revision: 626,
    motivo: 706,
  };

  private readonly tinta = rgb(0.15, 0.15, 0.18);
  private readonly gris = rgb(0.42, 0.42, 0.45);
  private readonly grisClaro = rgb(0.62, 0.62, 0.65);
  private readonly cabecera = rgb(0.18, 0.22, 0.28);
  private readonly filaAlterna = rgb(0.965, 0.965, 0.975);
  private readonly bandaPersona = rgb(0.93, 0.9, 0.93);
  private readonly blanco = rgb(1, 1, 1);
  private readonly alerta = rgb(0.72, 0.35, 0.12);
  private readonly malo = rgb(0.7, 0.18, 0.22);

  async generar(datos: AsistenciaRitmo, empresa = 'Mery García'): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    pdf.setTitle(`Asistencia ${datos.from} a ${datos.to}`);
    pdf.setCreator(empresa);

    const ctx: Contexto = {
      pdf,
      font,
      bold,
      page: pdf.addPage([this.ancho, this.alto]),
      y: this.alto - this.margen,
    };

    this.portada(ctx, datos, empresa);
    this.resumen(ctx, datos);

    const porPersona = this.agrupar(datos.rows);
    for (const [nombre, filas] of porPersona) {
      this.seccionPersona(ctx, nombre, filas);
    }

    if (datos.rows.length === 0) {
      ctx.page.drawText('No hubo movimientos en el período.', {
        x: this.margen,
        y: ctx.y - 10,
        size: 10,
        font,
        color: this.gris,
      });
    }

    this.pieDePagina(pdf, font, datos);
    return pdf.save();
  }

  // ------------------------------------------------------------ secciones

  private portada(ctx: Contexto, datos: AsistenciaRitmo, empresa: string): void {
    ctx.page.drawText('Reporte de asistencia', {
      x: this.margen,
      y: ctx.y - 6,
      size: 18,
      font: ctx.bold,
      color: this.tinta,
    });
    ctx.y -= 26;

    ctx.page.drawText(
      `${empresa}  ·  del ${fechaLarga(datos.from)} al ${fechaLarga(datos.to)}`,
      { x: this.margen, y: ctx.y, size: 10, font: ctx.font, color: this.gris },
    );
    ctx.y -= 13;

    const emitido = new Date().toLocaleString('es-AR', { timeZone: datos.timezone });
    ctx.page.drawText(`Emitido el ${emitido}  ·  horarios en ${datos.timezone}`, {
      x: this.margen,
      y: ctx.y,
      size: 8,
      font: ctx.font,
      color: this.grisClaro,
    });
    ctx.y -= 22;
  }

  private resumen(ctx: Contexto, datos: AsistenciaRitmo): void {
    const s = datos.summary;
    const celdas: Array<[string, string, boolean]> = [
      ['Personas', String(s.people), false],
      ['Horas trabajadas', horas(s.workedMinutes), false],
      ['Horas planificadas', horas(s.plannedMinutes), false],
      ['Días con llegada tarde', String(s.lateDays), s.lateDays > 0],
      ['Días ausente', String(s.absentDays), s.absentDays > 0],
      ['Días con licencia', String(s.leaveDays), false],
      ['Días a revisar', String(s.pendingDays), s.pendingDays > 0],
    ];

    const alto = 40;
    ctx.page.drawRectangle({
      x: this.margen - 4,
      y: ctx.y - alto + 12,
      width: this.ancho - this.margen * 2 + 8,
      height: alto,
      color: this.filaAlterna,
    });

    const ancho = (this.ancho - this.margen * 2) / celdas.length;
    celdas.forEach(([etiqueta, valor, destacar], i) => {
      const x = this.margen + i * ancho;
      ctx.page.drawText(etiqueta, {
        x,
        y: ctx.y + 1,
        size: 7.5,
        font: ctx.font,
        color: this.gris,
      });
      ctx.page.drawText(valor, {
        x,
        y: ctx.y - 14,
        size: 13,
        font: ctx.bold,
        color: destacar ? this.alerta : this.tinta,
      });
    });

    ctx.y -= alto + 12;
  }

  private seccionPersona(ctx: Contexto, nombre: string, filas: FilaAsistencia[]): void {
    // La persona y su encabezado de tabla no se separan del primer día: un
    // título solo al pie de una página no se entiende.
    this.asegurarEspacio(ctx, 20 + 18 + 16);

    ctx.page.drawRectangle({
      x: this.margen - 4,
      y: ctx.y - 5,
      width: this.ancho - this.margen * 2 + 8,
      height: 18,
      color: this.bandaPersona,
    });
    ctx.page.drawText(nombre, {
      x: this.margen,
      y: ctx.y,
      size: 10,
      font: ctx.bold,
      color: this.tinta,
    });

    const trabajado = filas.reduce((a, f) => a + f.workedMinutes, 0);
    const plan = filas.reduce((a, f) => a + f.plannedMinutes, 0);
    this.derecha(
      ctx,
      `${horas(trabajado)} trabajadas de ${horas(plan)} planificadas`,
      this.ancho - this.margen,
      ctx.y,
      8.5,
      ctx.font,
      this.gris,
    );
    ctx.y -= 22;

    this.encabezadoTabla(ctx);

    filas.forEach((fila, i) => {
      if (this.asegurarEspacio(ctx, 15)) this.encabezadoTabla(ctx);
      this.fila(ctx, fila, i);
    });

    ctx.y -= 10;
  }

  private encabezadoTabla(ctx: Contexto): void {
    ctx.page.drawRectangle({
      x: this.margen - 4,
      y: ctx.y - 5,
      width: this.ancho - this.margen * 2 + 8,
      height: 16,
      color: this.cabecera,
    });

    const t = (texto: string, x: number) =>
      ctx.page.drawText(texto, { x, y: ctx.y, size: 7.5, font: ctx.bold, color: this.blanco });
    const d = (texto: string, x: number) =>
      this.derecha(ctx, texto, x, ctx.y, 7.5, ctx.bold, this.blanco);

    t('Fecha', this.col.fecha);
    t('Día', this.col.dia);
    t('Turno', this.col.turno);
    t('Entrada', this.col.entrada);
    t('Salida', this.col.salida);
    d('Pausa', this.col.pausa);
    d('Trabajado', this.col.trabajado);
    d('Saldo', this.col.saldo);
    d('Tarde', this.col.tarde);
    t('Estado', this.col.estado);
    t('Revisión', this.col.revision);
    t('Observación', this.col.motivo);

    ctx.y -= 18;
  }

  private fila(ctx: Contexto, fila: FilaAsistencia, indice: number): void {
    if (indice % 2 === 0) {
      ctx.page.drawRectangle({
        x: this.margen - 4,
        y: ctx.y - 4,
        width: this.ancho - this.margen * 2 + 8,
        height: 14,
        color: this.filaAlterna,
      });
    }

    const t = (texto: string, x: number, color = this.tinta) =>
      ctx.page.drawText(texto, { x, y: ctx.y, size: 7.5, font: ctx.font, color });
    const d = (texto: string, x: number, color = this.tinta) =>
      this.derecha(ctx, texto, x, ctx.y, 7.5, ctx.font, color);

    t(fechaCorta(fila.day), this.col.fecha);
    t(nombreDia(fila.day), this.col.dia);
    t(fila.shiftStart ? `${fila.shiftStart}–${fila.shiftEnd}` : '—', this.col.turno);
    t(fila.checkIn ?? '—', this.col.entrada);
    t(fila.checkOut ?? '—', this.col.salida);
    d(fila.breakMinutes ? duracion(fila.breakMinutes) : '—', this.col.pausa);
    d(duracion(fila.workedMinutes), this.col.trabajado);
    d(
      fila.plannedMinutes ? duracion(fila.balanceMinutes) : '—',
      this.col.saldo,
      fila.balanceMinutes < 0 ? this.malo : this.tinta,
    );
    d(
      fila.lateMinutes ? `${fila.lateMinutes}m` : '—',
      this.col.tarde,
      fila.lateMinutes > 0 ? this.alerta : this.tinta,
    );
    t(
      ESTADO[fila.state],
      this.col.estado,
      fila.state === 'AUSENTE' ? this.malo : this.tinta,
    );
    t(
      fila.review ? REVISION[fila.review] : '—',
      this.col.revision,
      fila.review === 'PENDIENTE' || fila.review === 'RECHAZADO' ? this.alerta : this.tinta,
    );

    const observacion =
      fila.reviewReason ??
      (fila.absenceKind
        ? `${fila.absenceKind.replace(/_/g, ' ').toLowerCase()} (${(fila.absenceStatus ?? '').toLowerCase()})`
        : '');
    if (observacion) {
      t(this.recortar(ctx, observacion, this.ancho - this.margen - this.col.motivo), this.col.motivo, this.gris);
    }

    ctx.y -= 14;
  }

  private pieDePagina(pdf: PDFDocument, font: PDFFont, datos: AsistenciaRitmo): void {
    const paginas = pdf.getPages();
    paginas.forEach((pagina, i) => {
      const texto = `${datos.from} a ${datos.to}   ·   página ${i + 1} de ${paginas.length}`;
      const ancho = font.widthOfTextAtSize(texto, 7.5);
      pagina.drawText(texto, {
        x: this.ancho - this.margen - ancho,
        y: 18,
        size: 7.5,
        font,
        color: this.grisClaro,
      });
    });
  }

  // -------------------------------------------------------------- apoyo

  /** Agrupa por persona manteniendo el orden en que vinieron las filas. */
  private agrupar(filas: FilaAsistencia[]): Map<string, FilaAsistencia[]> {
    const mapa = new Map<string, FilaAsistencia[]>();
    for (const fila of filas) {
      const clave = fila.employeeCode
        ? `${fila.fullName} (${fila.employeeCode})`
        : fila.fullName;
      const actual = mapa.get(clave);
      if (actual) actual.push(fila);
      else mapa.set(clave, [fila]);
    }
    return mapa;
  }

  /** Abre página nueva si no entra. Devuelve true si la abrió. */
  private asegurarEspacio(ctx: Contexto, necesario: number): boolean {
    if (ctx.y - necesario >= this.margen + 20) return false;
    ctx.page = ctx.pdf.addPage([this.ancho, this.alto]);
    ctx.y = this.alto - this.margen;
    return true;
  }

  private derecha(
    ctx: Contexto,
    texto: string,
    x: number,
    y: number,
    tam: number,
    font: PDFFont,
    color = this.tinta,
  ): void {
    ctx.page.drawText(texto, { x: x - font.widthOfTextAtSize(texto, tam), y, size: tam, font, color });
  }

  /** Corta con puntos suspensivos para que la observación no pise el margen. */
  private recortar(ctx: Contexto, texto: string, anchoMax: number): string {
    let recortado = texto;
    while (
      recortado.length > 1 &&
      ctx.font.widthOfTextAtSize(recortado, 7.5) > anchoMax
    ) {
      recortado = recortado.slice(0, -2);
    }
    return recortado.length < texto.length ? `${recortado}…` : texto;
  }
}

interface Contexto {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}
