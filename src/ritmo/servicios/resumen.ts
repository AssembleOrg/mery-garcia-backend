/**
 * Resumen de servicios del día para Ritmo: cuántos hizo cada trabajadora de
 * cada categoría (A, B, C, consultas...). Es lo que ve al cerrar el turno y
 * lo que confirma.
 *
 * Se cuenta por ítem de comanda (cantidad), sólo servicios (los productos no
 * son "servicios hechos"), de comandas de ingreso no canceladas, estén o no
 * validadas: la validación sella el número, pero el día de la persona es el
 * mismo. Lo que no está validado se dice aparte ("2 validadas").
 */

import type { GananciaDia, SeccionDia } from './resumen-detalle';

export interface FilaServiciosDia {
  categoriaId: string | null;
  cantidad: number;
  validadas: number;
}

export interface LineaResumen {
  key: string;
  label: string;
  count: number;
  validadas: number;
  detail: string;
}

export interface ConfirmacionVista {
  confirmadoEn: Date;
  conforme: boolean;
  nota: string | null;
}

/** Lo que se le responde a Ritmo (su contrato `DaySummary`). */
export interface ResumenParaRitmo {
  available: true;
  day: string;
  title: string;
  /** El número que va arriba de todo: en cuántas comandas estuvo. */
  highlights: { key: string; label: string; count: number }[];
  items: { key: string; label: string; count: number; detail: string }[];
  total: number;
  note: string | null;
  /** La comisión del día en plata (null = no se muestra). */
  earnings: GananciaDia | null;
  /** Qué hizo, uno por uno: servicios, clientas que no vinieron, productos. */
  sections: SeccionDia[];
  confirmation: {
    required: boolean;
    confirmedAt: string | null;
    agreed: boolean | null;
    note: string | null;
  };
}

export const SIN_CATEGORIA = 'Sin categoría';
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** AAAA-MM-DD y que exista como fecha. */
export function validarDia(dia: string): string {
  if (!DIA.test(dia)) throw new Error('El día tiene que ser AAAA-MM-DD.');
  const [y, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  if (
    f.getUTCFullYear() !== y ||
    f.getUTCMonth() !== m - 1 ||
    f.getUTCDate() !== d
  ) {
    throw new Error(`El día ${dia} no existe.`);
  }
  return dia;
}

/** "2 validadas", "sin validar", "todas validadas". */
export function detalleValidacion(cantidad: number, validadas: number): string {
  if (cantidad === 0) return '';
  if (validadas === 0) return 'sin validar';
  if (validadas >= cantidad)
    return cantidad === 1 ? 'validada' : 'todas validadas';
  return `${validadas} ${validadas === 1 ? 'validada' : 'validadas'}`;
}

/**
 * Arma las líneas: una por categoría en su orden, y "Sin categoría" al final
 * sólo si hubo servicios sin categoría. Las categorías sin nada ese día van
 * igual en 0: así la persona ve que de B no hizo ninguno, no que B no existe.
 */
export function armarLineas(
  categorias: { id: string; nombre: string; orden: number }[],
  filas: FilaServiciosDia[],
): LineaResumen[] {
  const porCategoria = new Map<string | null, FilaServiciosDia>();
  for (const f of filas) {
    const previa = porCategoria.get(f.categoriaId);
    if (previa) {
      previa.cantidad += f.cantidad;
      previa.validadas += f.validadas;
    } else {
      porCategoria.set(f.categoriaId, { ...f });
    }
  }

  const lineas: LineaResumen[] = [...categorias]
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    .map((c) => {
      const f = porCategoria.get(c.id);
      const cantidad = f?.cantidad ?? 0;
      const validadas = f?.validadas ?? 0;
      return {
        key: c.id,
        label: c.nombre,
        count: cantidad,
        validadas,
        detail: detalleValidacion(cantidad, validadas),
      };
    });

  const sueltos = porCategoria.get(null);
  if (sueltos && sueltos.cantidad > 0) {
    lineas.push({
      key: 'sin-categoria',
      label: SIN_CATEGORIA,
      count: sueltos.cantidad,
      validadas: sueltos.validadas,
      detail: detalleValidacion(sueltos.cantidad, sueltos.validadas),
    });
  }
  return lineas;
}

/** "1 comanda" / "7 comandas". */
export const etiquetaComandas = (n: number) =>
  n === 1 ? 'comanda' : 'comandas';

/**
 * Tiene que confirmar si está marcada para hacerlo siempre (Luna, Rosario) o
 * si ese día figura en alguna comanda (Ivonne sólo los días que atendió).
 */
export function confirmacionObligatoria(
  confirmaSiempre: boolean,
  comandas: number,
): boolean {
  return confirmaSiempre || comandas > 0;
}

export function armarResumen(input: {
  dia: string;
  lineas: LineaResumen[];
  /** Comandas distintas con algún ítem a su nombre ese día. */
  comandas: number;
  confirmacionObligatoria: boolean;
  confirmacion: ConfirmacionVista | null;
  earnings?: GananciaDia | null;
  sections?: SeccionDia[];
}): ResumenParaRitmo {
  const total = input.lineas.reduce((s, l) => s + l.count, 0);
  const sinValidar = input.lineas.reduce(
    (s, l) => s + (l.count - l.validadas),
    0,
  );
  return {
    available: true,
    day: input.dia,
    title: 'Servicios del día',
    highlights: [
      {
        key: 'comandas',
        label: etiquetaComandas(input.comandas),
        count: input.comandas,
      },
    ],
    items: input.lineas.map(({ key, label, count, detail }) => ({
      key,
      label,
      count,
      detail,
    })),
    total,
    earnings: input.earnings ?? null,
    sections: input.sections ?? [],
    note:
      total === 0
        ? null
        : sinValidar > 0
          ? 'Lo que todavía no está validado en caja puede cambiar; el número queda sellado al validar la comanda.'
          : 'Todas las comandas de este día ya están validadas.',
    confirmation: {
      required: input.confirmacionObligatoria,
      confirmedAt: input.confirmacion?.confirmadoEn.toISOString() ?? null,
      agreed: input.confirmacion?.conforme ?? null,
      note: input.confirmacion?.nota ?? null,
    },
  };
}

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * ¿"Luna García" (Ritmo) es "Luna" (trabajadora)? Se compara el primer
 * nombre, sin acentos. Es el respaldo para cuando no se cargó el
 * ritmoUserId; con dos trabajadoras del mismo primer nombre no sirve y hay
 * que vincular a mano.
 */
export function coincideNombre(
  nombreRitmo: string,
  nombreTrabajadora: string,
): boolean {
  const a = sinAcentos(nombreRitmo).split(/\s+/)[0];
  const b = sinAcentos(nombreTrabajadora).split(/\s+/)[0];
  return a.length > 0 && a === b;
}
