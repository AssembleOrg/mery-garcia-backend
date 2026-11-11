/**
 * Lo que Ritmo le muestra a la administración: la producción de todo el
 * equipo en un rango de días (cuántos servicios de cada categoría hizo cada
 * una, en cuántas comandas, qué servicios y si confirmó el día), y el
 * catálogo de categorías con sus servicios.
 *
 * Son los mismos números que ve cada persona al cerrar su turno (mismas
 * consultas y mismo cálculo), juntos. Sin plata.
 */
import type { LineaComision } from 'src/comanda/comisiones/detalle';
import { armarListado } from './resumen-detalle';
import type { SeccionDia } from './resumen-detalle';
import {
  SIN_CATEGORIA,
  confirmacionObligatoria,
  etiquetaComandas,
  validarDia,
  type ConfirmacionVista,
  type LineaResumen,
} from './resumen';

/** Rango más largo que se le contesta a Ritmo de una vez. */
export const MAX_DIAS_EQUIPO = 31;

export interface DiaEquipo {
  day: string;
  highlights: { key: string; label: string; count: number }[];
  items: { key: string; label: string; count: number; detail: string }[];
  total: number;
  sections: SeccionDia[];
  /** null: ese día no se confirma (anterior al arranque, o sin Ritmo). */
  confirmation: {
    required: boolean;
    confirmedAt: string | null;
    agreed: boolean | null;
    note: string | null;
  } | null;
}

export interface PersonaEquipo {
  key: string;
  /** Su persona en Ritmo, si está vinculada. */
  userId: string | null;
  name: string;
  /** El total del rango, ya con su etiqueta: "12 comandas". */
  highlights: { key: string; label: string; count: number }[];
  /** Sólo los días con algo: comandas, servicios o una confirmación. */
  days: DiaEquipo[];
}

export interface EquipoParaRitmo {
  from: string;
  to: string;
  /** Las categorías en su orden, para armar las columnas aunque nadie haya hecho nada. */
  categories: { key: string; label: string }[];
  /** El total de todo el equipo en el rango. */
  highlights: { key: string; label: string; count: number }[];
  people: PersonaEquipo[];
}

export interface TrabajadoraEquipo {
  id: string;
  nombre: string;
  activo: boolean;
  borrada: boolean;
  ritmoUserId: string | null;
  ritmoConfirmaServicios: boolean;
}

export interface DiaTrabajado {
  trabajadorId: string;
  dia: string;
  comandas: number;
  lineas: LineaResumen[];
  total: number;
  confirmacion: ConfirmacionVista | null;
}

/** Valida el rango y devuelve cuántos días abarca. */
export function validarRango(desde: string, hasta: string): number {
  const d = validarDia(desde);
  const h = validarDia(hasta);
  if (h < d) throw new Error('"to" es anterior a "from".');
  const dias =
    Math.round(
      (Date.parse(`${h}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  if (dias > MAX_DIAS_EQUIPO)
    throw new Error(`El rango no puede pasar de ${MAX_DIAS_EQUIPO} días.`);
  return dias;
}

/**
 * Una persona por trabajadora activa (haya hecho algo o no: así se ve que
 * no hizo nada), más las dadas de baja que tengan algo en el rango. Por
 * nombre.
 */
export function armarEquipo(input: {
  desde: string;
  hasta: string;
  /** Primer día que se confirma desde Ritmo; lo anterior va sin confirmación. */
  resumenDesde: string;
  categorias: { id: string; nombre: string; orden: number }[];
  trabajadoras: TrabajadoraEquipo[];
  dias: DiaTrabajado[];
  /** Renglones del cálculo de comisiones del rango, por trabajadora. */
  detalle: Map<string, LineaComision[]>;
}): EquipoParaRitmo {
  const diasPor = new Map<string, DiaTrabajado[]>();
  for (const d of input.dias)
    diasPor.set(d.trabajadorId, [...(diasPor.get(d.trabajadorId) ?? []), d]);

  const people = input.trabajadoras
    .filter((t) => (t.activo && !t.borrada) || diasPor.has(t.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((t): PersonaEquipo => {
      const renglones = input.detalle.get(t.id) ?? [];
      const days = (diasPor.get(t.id) ?? [])
        .sort((a, b) => a.dia.localeCompare(b.dia))
        .map((d): DiaEquipo => {
          const seConfirma = !!t.ritmoUserId && d.dia >= input.resumenDesde;
          return {
            day: d.dia,
            highlights: [
              {
                key: 'comandas',
                label: etiquetaComandas(d.comandas),
                count: d.comandas,
              },
            ],
            items: d.lineas.map(({ key, label, count, detail }) => ({
              key,
              label,
              count,
              detail,
            })),
            total: d.total,
            sections: armarListado(renglones.filter((l) => l.dia === d.dia)),
            confirmation:
              seConfirma || d.confirmacion
                ? {
                    required:
                      seConfirma &&
                      confirmacionObligatoria(
                        t.ritmoConfirmaServicios,
                        d.comandas,
                      ),
                    confirmedAt:
                      d.confirmacion?.confirmadoEn.toISOString() ?? null,
                    agreed: d.confirmacion?.conforme ?? null,
                    note: d.confirmacion?.nota ?? null,
                  }
                : null,
          };
        });
      return {
        key: t.id,
        userId: t.ritmoUserId,
        name: t.nombre,
        highlights: [comandasDe(days)],
        days,
      };
    });

  return {
    from: input.desde,
    to: input.hasta,
    categories: [...input.categorias]
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
      .map((c) => ({ key: c.id, label: c.nombre })),
    highlights: [comandasDe(people.flatMap((p) => p.days))],
    people,
  };
}

/** "12 comandas": las de todos esos días juntas. */
function comandasDe(days: DiaEquipo[]) {
  const count = days.reduce((s, d) => s + (d.highlights[0]?.count ?? 0), 0);
  return { key: 'comandas', label: etiquetaComandas(count), count };
}

export interface CatalogoParaRitmo {
  title: string;
  groups: {
    key: string;
    label: string;
    detail: string | null;
    items: { key: string; label: string }[];
  }[];
}

/**
 * Las categorías en su orden con los servicios activos de cada una, y al
 * final lo que todavía no tiene categoría (si hay). Una categoría sin
 * servicios va igual: está cargada, aunque vacía.
 */
export function armarCatalogo(
  categorias: {
    id: string;
    nombre: string;
    orden: number;
    descripcion?: string | null;
  }[],
  servicios: { id: string; nombre: string; categoriaId: string | null }[],
): CatalogoParaRitmo {
  const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
    a.nombre.localeCompare(b.nombre, 'es');
  const de = (categoriaId: string | null) =>
    servicios
      .filter((s) => s.categoriaId === categoriaId)
      .sort(porNombre)
      .map((s) => ({ key: s.id, label: s.nombre }));

  const groups = [...categorias]
    .sort((a, b) => a.orden - b.orden || porNombre(a, b))
    .map((c) => ({
      key: c.id,
      label: c.nombre,
      detail: c.descripcion?.trim() || null,
      items: de(c.id),
    }));
  const conocidas = new Set(categorias.map((c) => c.id));
  const sueltos = servicios
    .filter((s) => !s.categoriaId || !conocidas.has(s.categoriaId))
    .sort(porNombre)
    .map((s) => ({ key: s.id, label: s.nombre }));
  if (sueltos.length) {
    groups.push({
      key: 'sin-categoria',
      label: SIN_CATEGORIA,
      detail:
        'Servicios que todavía no tienen categoría: no suman en A, B ni C.',
      items: sueltos,
    });
  }
  return { title: 'Categorías de servicios', groups };
}
