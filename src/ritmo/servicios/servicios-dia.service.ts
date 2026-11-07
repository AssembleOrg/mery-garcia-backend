import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';
import { CategoriaServicio } from 'src/comanda/entities/categoriaServicio.entity';
import { RitmoService } from '../ritmo.service';
import { ComandaService } from 'src/comanda/comanda.service';
import type { LineaComision } from 'src/comanda/comisiones/detalle';
import { armarListado } from './resumen-detalle';
import type { GananciaDia, SeccionDia } from './resumen-detalle';
import { TZ_EMPRESA, hoyEnEmpresa } from '../turnos/fechas';
import { ConfirmacionServiciosDia } from './entities/ConfirmacionServiciosDia.entity';
import {
  armarLineas,
  armarResumen,
  coincideNombre,
  confirmacionObligatoria,
  validarDia,
  type LineaResumen,
  type ResumenParaRitmo,
} from './resumen';
import {
  FilaSqlComandas,
  FilaSqlServicios,
  SQL_COMANDAS_POR_DIA,
  SQL_SERVICIOS_POR_DIA,
} from './servicios-dia.sql';

interface PersonalRitmo {
  people: { id: string; fullName: string; role: string; isActive: boolean }[];
}

/** Resumen de un día de una trabajadora, para la pantalla de administración. */
export interface DiaDeTrabajadora {
  trabajadorId: string;
  nombre: string;
  dia: string;
  /** En cuántas comandas estuvo ese día. */
  comandas: number;
  lineas: LineaResumen[];
  total: number;
  confirmacion: {
    confirmadoEn: Date;
    conforme: boolean;
    nota: string | null;
  } | null;
}

export interface VinculoRitmo {
  trabajadorId: string;
  nombre: string;
  activo: boolean;
  ritmoUserId: string | null;
  ritmoConfirmaServicios: boolean;
  /** Puede anotar productos desde Ritmo. */
  ritmoRegistraProductos: boolean;
  /** Persona de Ritmo que coincide por nombre, si no está vinculada a mano. */
  sugerencia: { id: string; fullName: string } | null;
}

/** Cada cuánto se vuelve a pedir el personal a Ritmo para resolver nombres. */
const CACHE_PERSONAL_MS = 5 * 60_000;

/**
 * Qué servicios hizo cada trabajadora cada día, contado por categoría. Es lo
 * que Ritmo le muestra a la persona al cerrar el turno, y lo que la persona
 * confirma desde allá.
 */
@Injectable()
export class ServiciosDiaService {
  private readonly logger = new Logger(ServiciosDiaService.name);
  private personalRitmo: {
    en: number;
    people: PersonalRitmo['people'];
  } | null = null;

  constructor(
    @InjectRepository(Trabajador)
    private readonly trabajadores: Repository<Trabajador>,
    @InjectRepository(CategoriaServicio)
    private readonly categorias: Repository<CategoriaServicio>,
    @InjectRepository(ConfirmacionServiciosDia)
    private readonly confirmaciones: Repository<ConfirmacionServiciosDia>,
    private readonly ritmo: RitmoService,
    private readonly comandas: ComandaService,
  ) {}

  // ===================== Lo que consulta Ritmo =====================

  /**
   * Resumen de un día para una persona de Ritmo. Si no se sabe qué
   * trabajadora es, `available: false`: Ritmo no muestra nada y no es un
   * error (Karina o Micaela fichan pero no hacen servicios).
   */
  async resumenParaRitmo(
    ritmoUserId: string,
    dia: string,
  ): Promise<ResumenParaRitmo | { available: false; day: string }> {
    const day = validarDia(dia);
    const trabajadora = await this.trabajadoraDeRitmo(ritmoUserId);
    if (!trabajadora) return { available: false, day };

    const [lineas, comandas, confirmacion] = await Promise.all([
      this.lineasDe(trabajadora.id, day),
      this.comandasDe(trabajadora.id, day),
      this.confirmaciones.findOne({
        where: { trabajadorId: trabajadora.id, dia: day },
      }),
    ]);
    const { earnings, sections } = await this.plataYListado(
      trabajadora.id,
      day,
    );
    return armarResumen({
      dia: day,
      lineas,
      comandas,
      earnings,
      sections,
      confirmacionObligatoria: confirmacionObligatoria(
        trabajadora.ritmoConfirmaServicios,
        comandas,
      ),
      confirmacion,
    });
  }

  /** La persona confirmó (o discutió) desde Ritmo. Una por día; la última pisa. */
  async confirmarDesdeRitmo(input: {
    userId: string;
    day: string;
    agreed: boolean;
    note?: string | null;
    punchId?: string | null;
  }): Promise<{ confirmedAt: string }> {
    const day = validarDia(input.day);
    if (day > hoyEnEmpresa())
      throw new BadRequestException('Ese día todavía no pasó.');
    const trabajadora = await this.trabajadoraDeRitmo(input.userId);
    if (!trabajadora) {
      throw new NotFoundException(
        'Esa persona de Ritmo no está vinculada a ninguna trabajadora.',
      );
    }
    const nota = input.note?.trim() || null;
    if (!input.agreed && !nota) {
      throw new BadRequestException('Si no coincide, hace falta decir qué.');
    }

    const [lineas, comandas] = await Promise.all([
      this.lineasDe(trabajadora.id, day),
      this.comandasDe(trabajadora.id, day),
    ]);
    const ahora = new Date();
    const existente = await this.confirmaciones.findOne({
      where: { trabajadorId: trabajadora.id, dia: day },
    });
    const fila =
      existente ??
      this.confirmaciones.create({ trabajadorId: trabajadora.id, dia: day });
    fila.ritmoUserId = input.userId;
    fila.conforme = input.agreed;
    fila.nota = nota;
    fila.resumen = lineas.map(({ key, label, count, validadas }) => ({
      key,
      label,
      count,
      validadas,
    }));
    fila.comandas = comandas;
    fila.ritmoPunchId = input.punchId ?? null;
    fila.confirmadoEn = ahora;
    await this.confirmaciones.save(fila);

    this.logger.log(
      `${trabajadora.nombre} ${input.agreed ? 'confirmó' : 'discutió'} sus servicios del ${day}` +
        (nota ? `: ${nota}` : ''),
    );
    return { confirmedAt: ahora.toISOString() };
  }

  // ===================== Administración =====================

  /** Un renglón por trabajadora y día del rango, con lo hecho y lo confirmado. */
  async listar(desde: string, hasta: string): Promise<DiaDeTrabajadora[]> {
    const d = validarDia(desde);
    const h = validarDia(hasta);
    if (h < d) throw new BadRequestException('"hasta" es anterior a "desde".');

    const [categorias, filas, comandas, trabajadoras, confirmaciones] =
      await Promise.all([
        this.categoriasOrdenadas(),
        this.trabajadores.manager.query<FilaSqlServicios[]>(
          SQL_SERVICIOS_POR_DIA,
          [TZ_EMPRESA, d, h, null],
        ),
        this.trabajadores.manager.query<FilaSqlComandas[]>(
          SQL_COMANDAS_POR_DIA,
          [TZ_EMPRESA, d, h, null],
        ),
        this.trabajadores.find({ withDeleted: true }),
        this.confirmaciones
          .createQueryBuilder('c')
          .where('c.dia BETWEEN :d AND :h', { d, h })
          .getMany(),
      ]);
    const nombres = new Map(trabajadoras.map((t) => [t.id, t.nombre]));
    const confirmadas = new Map(
      confirmaciones.map((c) => [`${c.trabajadorId}|${c.dia}`, c]),
    );

    const comandasPorClave = new Map(
      comandas.map((f) => [`${f.trabajadorId}|${f.dia}`, f.comandas]),
    );

    const porClave = new Map<string, FilaSqlServicios[]>();
    for (const f of filas) {
      const clave = `${f.trabajadorId}|${f.dia}`;
      porClave.set(clave, [...(porClave.get(clave) ?? []), f]);
    }
    // Si sólo vendió productos, estuvo en comandas aunque no hizo servicios.
    for (const clave of comandasPorClave.keys())
      if (!porClave.has(clave)) porClave.set(clave, []);
    // Un día confirmado sin servicios también es un renglón: dijo que no hizo nada.
    for (const clave of confirmadas.keys())
      if (!porClave.has(clave)) porClave.set(clave, []);

    return [...porClave.entries()]
      .map(([clave, suyas]) => {
        const [trabajadorId, dia] = clave.split('|');
        const lineas = armarLineas(categorias, suyas);
        const c = confirmadas.get(clave);
        return {
          trabajadorId,
          nombre: nombres.get(trabajadorId) ?? '(sin nombre)',
          dia,
          comandas: comandasPorClave.get(clave) ?? 0,
          lineas,
          total: lineas.reduce((s, l) => s + l.count, 0),
          confirmacion: c
            ? {
                confirmadoEn: c.confirmadoEn,
                conforme: c.conforme,
                nota: c.nota,
              }
            : null,
        };
      })
      .sort(
        (a, b) =>
          a.dia.localeCompare(b.dia) || a.nombre.localeCompare(b.nombre),
      );
  }

  /** Quién es quién entre Ritmo y las trabajadoras, con sugerencia por nombre. */
  async vinculos(): Promise<VinculoRitmo[]> {
    const [trabajadoras, personal] = await Promise.all([
      this.trabajadores.find({ order: { nombre: 'ASC' } }),
      this.personal().catch((e: Error) => {
        this.logger.warn(
          `Sin personal de Ritmo para sugerir vínculos: ${e.message}`,
        );
        return [] as PersonalRitmo['people'];
      }),
    ]);
    return trabajadoras.map((t) => {
      const candidatas = personal.filter((p) =>
        coincideNombre(p.fullName, t.nombre),
      );
      return {
        trabajadorId: t.id,
        nombre: t.nombre,
        activo: t.activo,
        ritmoUserId: t.ritmoUserId,
        ritmoConfirmaServicios: t.ritmoConfirmaServicios,
        ritmoRegistraProductos: t.ritmoRegistraProductos,
        sugerencia:
          !t.ritmoUserId && candidatas.length === 1
            ? { id: candidatas[0].id, fullName: candidatas[0].fullName }
            : null,
      };
    });
  }

  async vincular(
    trabajadorId: string,
    cambios: {
      ritmoUserId?: string | null;
      ritmoConfirmaServicios?: boolean;
      ritmoRegistraProductos?: boolean;
    },
  ): Promise<VinculoRitmo> {
    const t = await this.trabajadores.findOne({ where: { id: trabajadorId } });
    if (!t)
      throw new NotFoundException(
        `Trabajador con ID ${trabajadorId} no encontrado`,
      );
    if (cambios.ritmoUserId !== undefined) {
      if (cambios.ritmoUserId) {
        const ocupado = await this.trabajadores.findOne({
          where: { ritmoUserId: cambios.ritmoUserId, id: Not(trabajadorId) },
        });
        if (ocupado) {
          throw new BadRequestException(
            `Esa persona de Ritmo ya está vinculada a ${ocupado.nombre}.`,
          );
        }
      }
      t.ritmoUserId = cambios.ritmoUserId || null;
    }
    if (cambios.ritmoConfirmaServicios !== undefined) {
      t.ritmoConfirmaServicios = cambios.ritmoConfirmaServicios;
    }
    if (cambios.ritmoRegistraProductos !== undefined) {
      t.ritmoRegistraProductos = cambios.ritmoRegistraProductos;
    }
    await this.trabajadores.save(t);
    return (await this.vinculos()).find(
      (v) => v.trabajadorId === trabajadorId,
    ) as VinculoRitmo;
  }

  // ===================== Internas =====================

  /**
   * Listado del día (qué servicio, categoría, cuántos y en qué comandas),
   * del mismo cálculo que la pantalla de Comisiones. Por ahora sin plata:
   * `earnings` va siempre null. Si falla, el resumen sale igual sin esto
   * (Ritmo espera 8 s y nunca debe trabar un cierre de turno).
   */
  private async plataYListado(
    trabajadorId: string,
    dia: string,
  ): Promise<{ earnings: GananciaDia | null; sections: SeccionDia[] }> {
    try {
      const r = (await this.comandas.calcularComisionesTrabajadores({
        fechaDesde: dia,
        fechaHasta: dia,
        detalle: true,
      })) as unknown as {
        trabajadores: Array<{
          trabajadorId: string;
          detalle?: LineaComision[];
        }>;
      };
      const fila = r.trabajadores.find((t) => t.trabajadorId === trabajadorId);
      return { earnings: null, sections: armarListado(fila?.detalle ?? []) };
    } catch (e) {
      this.logger.warn(
        `Resumen de Ritmo sin listado (${dia}): ${(e as Error).message}`,
      );
      return { earnings: null, sections: [] };
    }
  }

  private async lineasDe(
    trabajadorId: string,
    dia: string,
  ): Promise<LineaResumen[]> {
    const [categorias, filas] = await Promise.all([
      this.categoriasOrdenadas(),
      this.trabajadores.manager.query<FilaSqlServicios[]>(
        SQL_SERVICIOS_POR_DIA,
        [TZ_EMPRESA, dia, dia, trabajadorId],
      ),
    ]);
    return armarLineas(categorias, filas);
  }

  private async comandasDe(trabajadorId: string, dia: string): Promise<number> {
    const filas = await this.trabajadores.manager.query<FilaSqlComandas[]>(
      SQL_COMANDAS_POR_DIA,
      [TZ_EMPRESA, dia, dia, trabajadorId],
    );
    return filas[0]?.comandas ?? 0;
  }

  private async categoriasOrdenadas(): Promise<
    { id: string; nombre: string; orden: number }[]
  > {
    const cats = await this.categorias.find({
      order: { orden: 'ASC', nombre: 'ASC' },
    });
    return cats.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden }));
  }

  /**
   * La trabajadora detrás de una persona de Ritmo: por `ritmoUserId` si está
   * cargado; si no, por primer nombre contra el personal de Ritmo. El
   * respaldo por nombre sirve para arrancar sin cargar nada, pero con dos
   * trabajadoras del mismo nombre no decide: hay que vincular a mano.
   */
  private async trabajadoraDeRitmo(
    ritmoUserId: string,
  ): Promise<Trabajador | null> {
    const directa = await this.trabajadores.findOne({ where: { ritmoUserId } });
    if (directa) return directa;

    let personal: PersonalRitmo['people'];
    try {
      personal = await this.personal();
    } catch (e) {
      this.logger.warn(
        `No se pudo leer el personal de Ritmo: ${(e as Error).message}`,
      );
      return null;
    }
    const persona = personal.find((p) => p.id === ritmoUserId);
    if (!persona) return null;

    const activas = await this.trabajadores.find({
      where: { activo: true, ritmoUserId: IsNull() },
    });
    const candidatas = activas.filter((t) =>
      coincideNombre(persona.fullName, t.nombre),
    );
    if (candidatas.length !== 1) {
      if (candidatas.length > 1) {
        this.logger.warn(
          `${persona.fullName} (Ritmo) coincide con ${candidatas.map((c) => c.nombre).join(', ')}: vincular a mano`,
        );
      }
      return null;
    }
    this.logger.log(
      `${persona.fullName} (Ritmo) → ${candidatas[0].nombre} por nombre (sin ritmoUserId cargado)`,
    );
    return candidatas[0];
  }

  private async personal(): Promise<PersonalRitmo['people']> {
    if (
      this.personalRitmo &&
      Date.now() - this.personalRitmo.en < CACHE_PERSONAL_MS
    ) {
      return this.personalRitmo.people;
    }
    const r = (await this.ritmo.listarPersonal()) as PersonalRitmo;
    this.personalRitmo = { en: Date.now(), people: r.people };
    return r.people;
  }
}
