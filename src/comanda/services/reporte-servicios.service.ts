import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Comanda, Caja, EstadoDeComanda, TipoDeComanda } from '../entities/Comanda.entity';
import { ItemComanda } from '../entities/ItemComanda.entity';
import { TipoProductoServicio } from '../entities/productoServicio.entity';
import { TipoPago } from '../../enums/TipoPago.enum';

const TZ = 'America/Argentina/Buenos_Aires';

/** Unidades cuyos servicios se listan en USD (cosmetic tattoo). El resto, ARS. */
const UNIDADES_USD = ['Cosmetic Tatto', 'Tattoo'];
/** Unidad que NO es un servicio a los fines de este reporte. */
const UNIDAD_CONSULTAS = 'Consultas';

/** Cómo se muestra cada medio de pago y el orden en que sale en el PDF. */
export const MEDIOS_PAGO: { tipo: TipoPago; label: string }[] = [
  { tipo: TipoPago.EFECTIVO, label: 'Efectivo' },
  { tipo: TipoPago.MERCADO_PAGO, label: 'Mercado Pago' },
  { tipo: TipoPago.TRANSFERENCIA, label: 'Transferencia' },
  { tipo: TipoPago.TARJETA, label: 'Tarjeta' },
  { tipo: TipoPago.QR, label: 'QR' },
  { tipo: TipoPago.GIFT_CARD, label: 'Gift card' },
  { tipo: TipoPago.CHEQUE, label: 'Cheque' },
];

export interface FiltrosReporteServicios {
  fechaDesde?: string;
  fechaHasta?: string;
  /** Ids de trabajadoras a incluir. Sin esto, todas. */
  trabajadores?: string[];
}

export interface ServicioDetalle {
  nombre: string;
  cantidad: number;
  montoARS: number;
  montoUSD: number;
}

export interface SenaPorMedio {
  medio: TipoPago;
  label: string;
  /** Clientas distintas que dejaron una seña con este medio. */
  clientas: number;
  /** Cantidad de señas (una comanda con seña ARS + USD cuenta dos). */
  senas: number;
  montoARS: number;
  montoUSD: number;
}

export interface TrabajadoraReporte {
  trabajadorId: string;
  nombre: string;
  servicios: ServicioDetalle[];
  totalServiciosARS: number;
  totalServiciosUSD: number;
  cantidadServicios: number;
  senasPorMedio: SenaPorMedio[];
  totalSenasClientas: number;
  totalSenas: number;
}

export interface ReporteServicios {
  fechaDesde: string;
  fechaHasta: string;
  trabajadoras: TrabajadoraReporte[];
}

/**
 * Reporte para la vista de comisiones: por trabajadora, el detalle de sus
 * SERVICIOS (no productos, no consultas) con cantidad y monto, y el desglose
 * de las señas que trajeron sus clientas separadas por medio de pago.
 *
 * Va aparte del cálculo de comisiones a propósito: ese cálculo está afinado
 * contra las liquidaciones reales y no se toca. Acá se reusan los mismos
 * criterios de moneda para que los montos coincidan.
 *
 * La seña se atribuye a la trabajadora "por el servicio": cuenta para quien
 * hizo un servicio en la comanda donde esa seña se usó (criterio de July). Si
 * una comanda mezcla servicios de dos trabajadoras, la seña cuenta para ambas.
 */
@Injectable()
export class ReporteServiciosService {
  constructor(
    @InjectRepository(Comanda)
    private readonly comandaRepository: Repository<Comanda>,
  ) {}

  async generar(filtros: FiltrosReporteServicios): Promise<ReporteServicios> {
    const desde = filtros.fechaDesde
      ? DateTime.fromISO(filtros.fechaDesde, { zone: TZ }).startOf('day')
      : DateTime.now().setZone(TZ).startOf('day');
    const hasta = filtros.fechaHasta
      ? DateTime.fromISO(filtros.fechaHasta, { zone: TZ }).endOf('day')
      : desde.endOf('day');

    const filtroTrabajadores =
      filtros.trabajadores && filtros.trabajadores.length > 0
        ? new Set(filtros.trabajadores)
        : null;

    const comandas = await this.comandaRepository.find({
      where: {
        caja: Caja.CAJA_1,
        createdAt: Between(desde.toJSDate(), hasta.toJSDate()),
        tipoDeComanda: TipoDeComanda.INGRESO,
        estadoDeComanda: In([
          EstadoDeComanda.VALIDADO,
          EstadoDeComanda.PENDIENTE,
          EstadoDeComanda.TRASPASADA,
        ]),
      },
      relations: [
        'items',
        'items.trabajador',
        'items.productoServicio',
        'items.productoServicio.unidadNegocio',
        'prepagoARS',
        'prepagoUSD',
        'cliente',
      ],
    });

    const acc = new Map<string, Acumulador>();
    const tomar = (id: string, nombre: string): Acumulador => {
      let a = acc.get(id);
      if (!a) {
        a = {
          trabajadorId: id,
          nombre,
          servicios: new Map(),
          senas: new Map(),
        };
        acc.set(id, a);
      }
      return a;
    };

    for (const comanda of comandas) {
      const items = comanda.items ?? [];

      // Servicios (excluye productos y consultas) → por trabajadora.
      const trabajadorasConServicio = new Set<string>();
      for (const item of items) {
        if (!item.trabajador || !item.productoServicio) continue;
        if (filtroTrabajadores && !filtroTrabajadores.has(item.trabajador.id)) continue;
        if (item.productoServicio.tipo !== TipoProductoServicio.SERVICIO) continue;
        if (item.productoServicio.unidadNegocio?.nombre === UNIDAD_CONSULTAS) continue;

        const a = tomar(item.trabajador.id, item.trabajador.nombre);
        trabajadorasConServicio.add(item.trabajador.id);

        const nombre = item.productoServicio.nombre;
        const cantidad = Number(item.cantidad ?? 1);
        const subtotal = subtotalItem(item);
        const usd = esServicioUSD(item);

        const det = a.servicios.get(nombre) ?? { nombre, cantidad: 0, montoARS: 0, montoUSD: 0 };
        det.cantidad += cantidad;
        if (usd) det.montoUSD += subtotal;
        else det.montoARS += subtotal;
        a.servicios.set(nombre, det);
      }

      // Señas de esta comanda (ARS y/o USD) → a cada trabajadora con servicio.
      const senas = [comanda.prepagoARS, comanda.prepagoUSD].filter(
        (p): p is NonNullable<typeof p> => !!p && !!p.tipoPago,
      );
      if (senas.length === 0 || trabajadorasConServicio.size === 0) continue;
      const clienteId = comanda.cliente?.id ?? comanda.id; // sin clienta, cuenta como una

      for (const trabajadorId of trabajadorasConServicio) {
        const a = acc.get(trabajadorId)!;
        for (const sena of senas) {
          const medio = sena.tipoPago;
          const monto = Number(sena.monto ?? 0);
          const esUSD = String(sena.moneda) === 'USD';
          const s = a.senas.get(medio) ?? {
            medio,
            clientas: new Set<string>(),
            senas: 0,
            montoARS: 0,
            montoUSD: 0,
          };
          s.clientas.add(clienteId);
          s.senas += 1;
          if (esUSD) s.montoUSD += monto;
          else s.montoARS += monto;
          a.senas.set(medio, s);
        }
      }
    }

    const trabajadoras = [...acc.values()]
      .map((a) => this.armarTrabajadora(a))
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));

    return {
      fechaDesde: desde.toISODate() ?? desde.toString(),
      fechaHasta: hasta.toISODate() ?? hasta.toString(),
      trabajadoras,
    };
  }

  private armarTrabajadora(a: Acumulador): TrabajadoraReporte {
    const servicios = [...a.servicios.values()]
      .map((s) => ({
        nombre: s.nombre,
        cantidad: s.cantidad,
        montoARS: redondear(s.montoARS),
        montoUSD: redondear(s.montoUSD),
      }))
      .sort((x, y) => y.montoARS + y.montoUSD * 1e6 - (x.montoARS + x.montoUSD * 1e6));

    const senasPorMedio: SenaPorMedio[] = MEDIOS_PAGO.map(({ tipo, label }) => {
      const s = a.senas.get(tipo);
      return {
        medio: tipo,
        label,
        clientas: s ? s.clientas.size : 0,
        senas: s ? s.senas : 0,
        montoARS: s ? redondear(s.montoARS) : 0,
        montoUSD: s ? redondear(s.montoUSD) : 0,
      };
    }).filter((m) => m.senas > 0);

    return {
      trabajadorId: a.trabajadorId,
      nombre: a.nombre,
      servicios,
      totalServiciosARS: redondear(servicios.reduce((n, s) => n + s.montoARS, 0)),
      totalServiciosUSD: redondear(servicios.reduce((n, s) => n + s.montoUSD, 0)),
      cantidadServicios: servicios.reduce((n, s) => n + s.cantidad, 0),
      senasPorMedio,
      totalSenasClientas: senasPorMedio.reduce((n, m) => n + m.clientas, 0),
      totalSenas: senasPorMedio.reduce((n, m) => n + m.senas, 0),
    };
  }
}

interface Acumulador {
  trabajadorId: string;
  nombre: string;
  servicios: Map<string, ServicioDetalle>;
  senas: Map<TipoPago, { medio: TipoPago; clientas: Set<string>; senas: number; montoARS: number; montoUSD: number }>;
}

function esServicioUSD(item: ItemComanda): boolean {
  return (
    item.productoServicio?.tipo === TipoProductoServicio.SERVICIO &&
    !!item.productoServicio?.unidadNegocio?.nombre &&
    UNIDADES_USD.includes(item.productoServicio.unidadNegocio.nombre)
  );
}

/** Mismo criterio que el cálculo de comisiones: precio crudo, fallback a precioFijoARS si vino en 0. */
function precioBaseItem(item: ItemComanda): number {
  const precio = Number(item.precio ?? 0);
  if (precio !== 0) return precio;
  const precioFijoARS = Number(item.productoServicio?.precioFijoARS ?? 0);
  return precioFijoARS > 0 ? precioFijoARS : 0;
}

function subtotalItem(item: ItemComanda): number {
  return precioBaseItem(item) * Number(item.cantidad ?? 1) - Number(item.descuento ?? 0);
}

function redondear(n: number): number {
  return Number(n.toFixed(2));
}
