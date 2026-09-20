import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { PrepagoGuardado } from '../personal/entities/PrepagoGuardado.entity';
import { Comanda } from '../comanda/entities/Comanda.entity';
import { TipoProductoServicio } from '../comanda/entities/productoServicio.entity';
import { Coincidencia, compararServicio } from './servicio-tokens';

const TZ = 'America/Argentina/Buenos_Aires';

export interface FiltrosReservados {
  fechaDesde?: string;
  fechaHasta?: string;
  /** Solo las que no coinciden (reservó una cosa, se hizo otra). */
  soloDiscrepancias?: boolean;
}

export interface FilaReservado {
  prepagoId: string;
  bookingCode: string | null;
  fechaTurno: string | null;
  clienta: string;
  servicioReservado: string;
  empleadoReservado: string | null;
  estadoUso: 'SIN_USAR' | 'USADA';
  comandaNumero: string | null;
  comandaFecha: string | null;
  serviciosTomados: string[];
  coincidencia: Coincidencia | null;
}

export interface ReporteReservados {
  fechaDesde: string;
  fechaHasta: string;
  filas: FilaReservado[];
  resumen: {
    total: number;
    sinUsar: number;
    coincide: number;
    parcial: number;
    distinto: number;
    indeterminado: number;
  };
}

/**
 * "Reservó un servicio, ¿se hizo ese u otro?" Cruza cada seña que vino de una
 * reserva (tiene servicioReservado) con la comanda que la consumió, y compara
 * el servicio reservado contra los servicios efectivamente cargados.
 *
 * Solo ve reservas que entraron desde que se activó la integración: las señas
 * viejas no tienen servicioReservado y quedan fuera.
 */
@Injectable()
export class ReporteReservadosService {
  constructor(
    @InjectRepository(PrepagoGuardado)
    private readonly prepagos: Repository<PrepagoGuardado>,
    @InjectRepository(Comanda)
    private readonly comandas: Repository<Comanda>,
  ) {}

  async generar(filtros: FiltrosReservados): Promise<ReporteReservados> {
    const desde = filtros.fechaDesde
      ? DateTime.fromISO(filtros.fechaDesde, { zone: TZ }).startOf('day')
      : DateTime.now().setZone(TZ).startOf('month');
    const hasta = filtros.fechaHasta
      ? DateTime.fromISO(filtros.fechaHasta, { zone: TZ }).endOf('day')
      : DateTime.now().setZone(TZ).endOf('day');

    // Señas que vinieron de una reserva, en el rango. Se filtra por la fecha
    // del turno si existe; si no, por la fecha en que se creó la seña.
    const senas = await this.prepagos
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.cliente', 'cliente')
      .where('p.servicioReservado IS NOT NULL')
      .andWhere('COALESCE(p."fechaTurno", p."fechaCreacion") BETWEEN :desde AND :hasta', {
        desde: desde.toJSDate(),
        hasta: hasta.toJSDate(),
      })
      .orderBy('COALESCE(p."fechaTurno", p."fechaCreacion")', 'ASC')
      .getMany();

    const comandasPorPrepago = await this.comandasQueConsumieron(senas.map((s) => s.id));

    const filas: FilaReservado[] = [];
    for (const sena of senas) {
      const comanda = comandasPorPrepago.get(sena.id) ?? null;
      const serviciosTomados = comanda
        ? (comanda.items ?? [])
            .filter((i) => i.productoServicio?.tipo === TipoProductoServicio.SERVICIO)
            .map((i) => i.productoServicio?.nombre ?? i.nombre)
            .filter((n): n is string => !!n)
        : [];

      const coincidencia: Coincidencia | null = comanda
        ? compararServicio(sena.servicioReservado ?? '', serviciosTomados)
        : null;

      filas.push({
        prepagoId: sena.id,
        bookingCode: sena.bookingCode ?? null,
        fechaTurno: iso(sena.fechaTurno),
        clienta: sena.cliente?.nombre ?? 'Sin clienta',
        servicioReservado: sena.servicioReservado ?? '',
        empleadoReservado: sena.empleadoReservado ?? null,
        estadoUso: comanda ? 'USADA' : 'SIN_USAR',
        comandaNumero: comanda?.numero ?? null,
        comandaFecha: iso(comanda?.createdAt),
        serviciosTomados,
        coincidencia,
      });
    }

    const visibles = filtros.soloDiscrepancias
      ? filas.filter((f) => f.coincidencia === 'DISTINTO' || f.coincidencia === 'PARCIAL')
      : filas;

    return {
      fechaDesde: desde.toISODate() ?? desde.toString(),
      fechaHasta: hasta.toISODate() ?? hasta.toString(),
      filas: visibles,
      resumen: {
        total: filas.length,
        sinUsar: filas.filter((f) => f.estadoUso === 'SIN_USAR').length,
        coincide: filas.filter((f) => f.coincidencia === 'COINCIDE').length,
        parcial: filas.filter((f) => f.coincidencia === 'PARCIAL').length,
        distinto: filas.filter((f) => f.coincidencia === 'DISTINTO').length,
        indeterminado: filas.filter((f) => f.coincidencia === 'INDETERMINADO').length,
      },
    };
  }

  /** Mapa prepagoId → comanda que lo consumió (con sus items de servicio). */
  private async comandasQueConsumieron(prepagoIds: string[]): Promise<Map<string, Comanda>> {
    const mapa = new Map<string, Comanda>();
    if (prepagoIds.length === 0) return mapa;

    const comandas = await this.comandas
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.items', 'item')
      .leftJoinAndSelect('item.productoServicio', 'ps')
      .where('c."prepagoARSID" IN (:...ids) OR c."prepagoUSDID" IN (:...ids)', { ids: prepagoIds })
      .getMany();

    for (const c of comandas) {
      const arsId = (c as unknown as { prepagoARSID?: string }).prepagoARSID;
      const usdId = (c as unknown as { prepagoUSDID?: string }).prepagoUSDID;
      if (arsId && !mapa.has(arsId)) mapa.set(arsId, c);
      if (usdId && !mapa.has(usdId)) mapa.set(usdId, c);
    }
    return mapa;
  }
}

function iso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  return fecha instanceof Date ? fecha.toISOString() : new Date(fecha).toISOString();
}
