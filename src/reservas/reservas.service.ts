import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrepagoTurnoEvento } from './entities/prepago-turno-evento.entity';
import { PrepagoGuardado } from '../personal/entities/PrepagoGuardado.entity';
import { Cliente } from '../cliente/entities/Cliente.entity';
import { EstadoPrepago } from '../enums/EstadoPrepago.enum';
import { TipoMoneda } from '../enums/TipoMoneda.enum';
import { TipoPago } from '../enums/TipoPago.enum';
import { numeroLocal, soloDigitos, sufijoTelefono } from '../whatsapp/telefono';

/** Lo que manda booking cuando una reserva queda pagada por Mercado Pago. */
export interface ReservaPagadaDto {
  bookingId: string;
  bookingCode?: string;
  servicioReservado: string;
  /** Id del servicio en booking. */
  servicioId?: string;
  empleadoReservado?: string;
  categoria?: string;
  montoSena: number;
  moneda?: 'ARS' | 'USD';
  fechaTurno?: string;
  cliente: {
    fullName?: string;
    email?: string;
    phone?: string;
    dni?: string;
  };
}

/** Foto del turno que manda booking (antes/después de un cambio). */
export interface FotoTurno {
  startTime?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  status?: string | null;
}

/** Un cambio de la reserva en booking: reprogramación, cancelación o carga inicial. */
export interface EventoTurnoDto {
  eventoId: string;
  bookingId: string;
  bookingCode?: string;
  tipo: 'REPROGRAMADA' | 'CANCELADA' | 'ESTADO_INICIAL';
  origen?: 'CLIENTA' | 'ADMIN' | 'SISTEMA';
  actor?: string;
  ocurridoEn?: string;
  antes?: FotoTurno | null;
  despues?: FotoTurno | null;
}

export interface ResultadoEvento {
  ok: true;
  duplicado: boolean;
  /** true si la reserva no tiene seña acá (no se pagó por MP): no se guarda nada. */
  sinSena: boolean;
}

export interface ResultadoIngesta {
  ok: true;
  duplicado: boolean;
  prepagoId: string;
  clienteId: string;
  clienteCreado: boolean;
}

/**
 * Recibe una reserva pagada de booking y crea la seña en este sistema.
 *
 * Es idempotente por `bookingId`: si la misma reserva llega dos veces (reintento
 * del webhook, doble aviso), no se duplica la seña. La carga manual de señas
 * (efectivo en el local) sigue funcionando aparte: esas no traen bookingId.
 */
@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectRepository(PrepagoGuardado)
    private readonly prepagos: Repository<PrepagoGuardado>,
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
    @InjectRepository(PrepagoTurnoEvento)
    private readonly eventos: Repository<PrepagoTurnoEvento>,
  ) {}

  async ingerirReservaPagada(dto: ReservaPagadaDto): Promise<ResultadoIngesta> {
    const bookingId = (dto.bookingId ?? '').trim();
    if (!bookingId) throw new BadRequestException('Falta bookingId.');
    if (!dto.servicioReservado?.trim()) throw new BadRequestException('Falta el servicio reservado.');
    const monto = Number(dto.montoSena);
    if (!Number.isFinite(monto) || monto <= 0) throw new BadRequestException('Monto de seña inválido.');

    // Idempotencia: si ya existe la seña de esta reserva, no se crea otra.
    const existente = await this.prepagos.findOne({
      where: { bookingId },
      relations: ['cliente'],
      withDeleted: true,
    });
    if (existente) {
      return {
        ok: true,
        duplicado: true,
        prepagoId: existente.id,
        clienteId: existente.cliente?.id ?? '',
        clienteCreado: false,
      };
    }

    const { cliente, creado } = await this.buscarOCrearCliente(dto.cliente);

    const prepago = this.prepagos.create({
      monto,
      moneda: dto.moneda === 'USD' ? TipoMoneda.USD : TipoMoneda.ARS,
      estado: EstadoPrepago.ACTIVA,
      tipoPago: TipoPago.MERCADO_PAGO,
      cliente,
      observaciones: this.armarObservaciones(dto),
      servicioReservado: dto.servicioReservado.trim().slice(0, 200),
      serviciosReservados: [dto.servicioReservado.trim().slice(0, 200)],
      empleadoReservado: dto.empleadoReservado?.trim().slice(0, 150) || undefined,
      bookingId,
      bookingCode: dto.bookingCode?.trim().slice(0, 40) || undefined,
      fechaTurno: fecha(dto.fechaTurno) ?? undefined,
      fechaTurnoOriginal: fecha(dto.fechaTurno) ?? undefined,
      servicioOriginal: dto.servicioReservado.trim().slice(0, 200),
      servicioIdReservado: dto.servicioId?.trim().slice(0, 80) || undefined,
    });

    let guardado: PrepagoGuardado;
    try {
      guardado = await this.prepagos.save(prepago);
    } catch (error) {
      // Carrera: dos avisos casi simultáneos de la misma reserva. El índice
      // único de bookingId frena el segundo; lo tratamos como duplicado.
      const rehecho = await this.prepagos.findOne({ where: { bookingId }, relations: ['cliente'] });
      if (rehecho) {
        return { ok: true, duplicado: true, prepagoId: rehecho.id, clienteId: rehecho.cliente?.id ?? '', clienteCreado: false };
      }
      throw error;
    }

    await this.eventos
      .save(
        this.eventos.create({
          prepago: guardado,
          bookingId,
          eventoId: `pagada:${bookingId}`,
          tipo: 'CREADA',
          origen: 'CLIENTA',
          actor: dto.cliente?.fullName?.trim().slice(0, 150) || null,
          fechaTurnoNueva: fecha(dto.fechaTurno),
          servicioIdNuevo: dto.servicioId?.trim().slice(0, 80) || null,
          servicioNuevo: dto.servicioReservado.trim().slice(0, 200),
          empleadoNuevo: dto.empleadoReservado?.trim().slice(0, 150) || null,
          estadoReserva: 'CONFIRMED',
          ocurridoEn: guardado.fechaCreacion ?? new Date(),
        }),
      )
      .catch((error) => this.logger.error(`No se pudo guardar el evento CREADA de ${bookingId}`, error as Error));

    this.logger.log(
      `Seña de reserva ${dto.bookingCode ?? bookingId} creada (${prepago.moneda} ${monto}) para ${cliente.nombre}`,
    );
    return { ok: true, duplicado: false, prepagoId: guardado.id, clienteId: cliente.id, clienteCreado: creado };
  }

  /**
   * Registra un cambio del turno hecho en booking y deja la seña con el turno
   * vigente. Idempotente por `eventoId`. Si la reserva no tiene seña acá (no se
   * pagó por Mercado Pago), no guarda nada: booking conserva su propio historial.
   *
   * Los eventos pueden llegar desordenados (reintentos): el turno vigente de la
   * seña solo se pisa si el evento es el más nuevo que se recibió.
   */
  async registrarEvento(dto: EventoTurnoDto): Promise<ResultadoEvento> {
    const bookingId = (dto.bookingId ?? '').trim();
    const eventoId = (dto.eventoId ?? '').trim();
    if (!bookingId || !eventoId) throw new BadRequestException('Faltan bookingId o eventoId.');
    if (!['REPROGRAMADA', 'CANCELADA', 'ESTADO_INICIAL'].includes(dto.tipo)) {
      throw new BadRequestException('Tipo de evento inválido.');
    }

    if (await this.eventos.exist({ where: { eventoId } })) {
      return { ok: true, duplicado: true, sinSena: false };
    }
    const prepago = await this.prepagos.findOne({ where: { bookingId }, withDeleted: true });
    if (!prepago) return { ok: true, duplicado: false, sinSena: true };

    const ocurridoEn = fecha(dto.ocurridoEn) ?? new Date();
    const antes = dto.antes ?? {};
    const despues = dto.despues ?? {};

    const ultimo = await this.eventos.findOne({
      where: { bookingId },
      order: { ocurridoEn: 'DESC' },
    });
    const esElMasNuevo = !ultimo || ultimo.ocurridoEn.getTime() <= ocurridoEn.getTime();

    const evento = this.eventos.create({
      prepago,
      bookingId,
      eventoId: eventoId.slice(0, 80),
      tipo: dto.tipo,
      origen: (dto.origen ?? 'SISTEMA').slice(0, 20),
      actor: dto.actor?.trim().slice(0, 150) || null,
      fechaTurnoAnterior: fecha(antes.startTime),
      fechaTurnoNueva: fecha(despues.startTime),
      servicioIdAnterior: antes.serviceId?.slice(0, 80) ?? null,
      servicioIdNuevo: despues.serviceId?.slice(0, 80) ?? null,
      servicioAnterior: antes.serviceName?.slice(0, 200) ?? null,
      servicioNuevo: despues.serviceName?.slice(0, 200) ?? null,
      empleadoAnterior: antes.employeeName?.slice(0, 150) ?? null,
      empleadoNuevo: despues.employeeName?.slice(0, 150) ?? null,
      estadoReserva: despues.status?.slice(0, 20) ?? null,
      ocurridoEn,
    });

    try {
      await this.eventos.save(evento);
    } catch (error) {
      // Carrera con un reintento del mismo evento: el índice único lo frena.
      if (await this.eventos.exist({ where: { eventoId } })) {
        return { ok: true, duplicado: true, sinSena: false };
      }
      throw error;
    }

    // Resumen en la seña. Las reprogramaciones se cuentan siempre; el turno
    // vigente solo lo pisa el evento más nuevo.
    const cambios: Partial<PrepagoGuardado> = {};
    if (dto.tipo === 'REPROGRAMADA') {
      cambios.reprogramaciones = (prepago.reprogramaciones ?? 0) + 1;
    }
    if (dto.tipo === 'CANCELADA' || despues.status === 'CANCELLED') {
      if (!prepago.turnoCanceladoEn) cambios.turnoCanceladoEn = ocurridoEn;
    }
    if (esElMasNuevo && dto.tipo !== 'CANCELADA') {
      const nuevaFecha = fecha(despues.startTime);
      if (nuevaFecha) cambios.fechaTurno = nuevaFecha;
      if (despues.serviceName) {
        // Si la recepción cargó varios servicios a mano, se respetan; solo se
        // reemplaza cuando la seña apuntaba a un único servicio de booking.
        const lista = prepago.serviciosReservados ?? [];
        if (lista.length <= 1) {
          cambios.servicioReservado = despues.serviceName.slice(0, 200);
          cambios.serviciosReservados = [despues.serviceName.slice(0, 200)];
        }
      }
      if (despues.serviceId) cambios.servicioIdReservado = despues.serviceId.slice(0, 80);
      if (despues.employeeName) cambios.empleadoReservado = despues.employeeName.slice(0, 150);
    }
    if (dto.tipo === 'ESTADO_INICIAL') {
      // Carga inicial: si el turno de hoy no coincide con el que se guardó al
      // pagar, hubo al menos una reprogramación que no quedó registrada.
      const original = prepago.fechaTurnoOriginal ?? prepago.fechaTurno;
      if (!prepago.fechaTurnoOriginal && prepago.fechaTurno) cambios.fechaTurnoOriginal = prepago.fechaTurno;
      if (!prepago.servicioOriginal && prepago.servicioReservado) cambios.servicioOriginal = prepago.servicioReservado;
      const nueva = fecha(despues.startTime);
      if (
        (prepago.reprogramaciones ?? 0) === 0 &&
        ((original && nueva && original.getTime() !== nueva.getTime()) ||
          (prepago.servicioIdReservado && despues.serviceId && prepago.servicioIdReservado !== despues.serviceId))
      ) {
        cambios.reprogramaciones = 1;
      }
    }
    if (Object.keys(cambios).length) {
      await this.prepagos.update(prepago.id, cambios);
    }

    this.logger.log(`Turno ${dto.bookingCode ?? bookingId}: ${dto.tipo} (${dto.origen ?? 'SISTEMA'})`);
    return { ok: true, duplicado: false, sinSena: false };
  }

  /**
   * Busca la clienta por DNI, email o teléfono (todas las variantes argentinas)
   * y, si no existe, la crea con los datos de booking.
   */
  private async buscarOCrearCliente(
    datos: ReservaPagadaDto['cliente'],
  ): Promise<{ cliente: Cliente; creado: boolean }> {
    const dni = soloDigitos(datos?.dni) || null;
    const email = datos?.email?.trim().toLowerCase() || null;
    const telefono = datos?.phone?.trim() || null;

    if (dni) {
      const porDni = await this.clientes.findOne({ where: { dni } });
      if (porDni) return { cliente: porDni, creado: false };
    }
    if (email) {
      const porEmail = await this.clientes.findOne({ where: { email } });
      if (porEmail) return { cliente: porEmail, creado: false };
    }
    const sufijo = sufijoTelefono(telefono);
    if (sufijo) {
      const porTel = await this.clientes
        .createQueryBuilder('c')
        .where(`RIGHT(regexp_replace(COALESCE(c.telefono, ''), '\\D', '', 'g'), 8) = :sufijo`, { sufijo })
        .andWhere('c.deletedAt IS NULL')
        .orderBy('c.fechaRegistro', 'DESC')
        .getOne();
      if (porTel) {
        // Puede haber más de una con el mismo final; si el número local completo
        // coincide, esa gana; si no, vale la más reciente.
        const local = numeroLocal(telefono);
        const exacta = await this.clientes
          .createQueryBuilder('c')
          .where(`regexp_replace(COALESCE(c.telefono, ''), '\\D', '', 'g') LIKE :local`, { local: `%${local}` })
          .andWhere('c.deletedAt IS NULL')
          .getOne();
        return { cliente: exacta ?? porTel, creado: false };
      }
    }

    const cliente = this.clientes.create({
      nombre: (datos?.fullName?.trim() || 'Clienta de reserva').slice(0, 100),
      telefono: telefono ? soloDigitos(telefono) : '',
      email: email ?? '',
      dni: dni ?? undefined,
    });
    const creado = await this.clientes.save(cliente);
    this.logger.log(`Clienta creada desde booking: ${creado.nombre}`);
    return { cliente: creado, creado: true };
  }

  private armarObservaciones(dto: ReservaPagadaDto): string {
    const partes = ['Seña de reserva online'];
    if (dto.bookingCode) partes.push(`(${dto.bookingCode})`);
    partes.push(`— ${dto.servicioReservado.trim()}`);
    if (dto.empleadoReservado) partes.push(`con ${dto.empleadoReservado.trim()}`);
    return partes.join(' ').slice(0, 250);
  }
}

/** ISO → Date, o null si no viene o es inválida. */
function fecha(valor?: string | null): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}
