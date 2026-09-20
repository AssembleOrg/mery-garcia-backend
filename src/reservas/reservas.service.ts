import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      empleadoReservado: dto.empleadoReservado?.trim().slice(0, 150) || undefined,
      bookingId,
      bookingCode: dto.bookingCode?.trim().slice(0, 40) || undefined,
      fechaTurno: dto.fechaTurno ? new Date(dto.fechaTurno) : undefined,
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

    this.logger.log(
      `Seña de reserva ${dto.bookingCode ?? bookingId} creada (${prepago.moneda} ${monto}) para ${cliente.nombre}`,
    );
    return { ok: true, duplicado: false, prepagoId: guardado.id, clienteId: cliente.id, clienteCreado: creado };
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
