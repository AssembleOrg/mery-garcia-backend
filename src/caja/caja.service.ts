import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Caja as CajaEntity } from './entities/Caja.entity';
import { Comanda } from 'src/comanda/entities/Comanda.entity';
import { TransferirCajaDto } from './dto/transferir-caja.dto';
import { CrearMovimientoCajaDto } from './dto/movimiento-caja.dto';
import { MovimientoCaja } from './entities/MovimientoCaja.entity';
import { TipoMovimiento } from 'src/enums/TipoMovimiento.enum';
import { Caja } from 'src/enums/Caja.enum';
import { EstadoComanda } from 'src/comanda/entities/Comanda.entity';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Personal } from 'src/personal/entities/Personal.entity';

export interface BalanceCaja {
  caja: Caja;
  total: number;
  cantidadComandas: number;
  comandas: Array<{
    id: string;
    numero: string;
    totalFinal: number;
    fecha: Date;
    cliente: string;
  }>;
  saldoReal: number; // Incluye movimientos manuales
}

export interface TransferenciaResult {
  success: boolean;
  montoTransferido: number;
  comandasTransferidas: number;
  pdfBuffer?: Buffer;
}

export interface MovimientoResult {
  success: boolean;
  saldoAnterior: number;
  saldoPosterior: number;
  movimiento: MovimientoCaja;
}

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(CajaEntity)
    private cajaRepository: Repository<CajaEntity>,
    @InjectRepository(Comanda)
    private comandaRepository: Repository<Comanda>,
    @InjectRepository(MovimientoCaja)
    private movimientoCajaRepository: Repository<MovimientoCaja>,
    private dataSource: DataSource,
    private auditoriaService: AuditoriaService,
  ) {}

  async obtenerBalanceCaja(caja: Caja): Promise<BalanceCaja> {
    const comandas = await this.comandaRepository.find({
      where: {
        enCaja: caja,
        estado: EstadoComanda.COMPLETADO,
      },
      relations: ['cliente'],
      order: { fecha: 'DESC' },
    });

    const totalComandas = comandas.reduce((sum, comanda) => sum + comanda.totalFinal, 0);

    // Obtener movimientos manuales
    const movimientos = await this.movimientoCajaRepository.find({
      where: { caja },
      order: { createdAt: 'ASC' },
    });

    const totalMovimientos = movimientos.reduce((sum, movimiento) => {
      if (movimiento.tipoMovimiento === TipoMovimiento.INGRESO || 
          movimiento.tipoMovimiento === TipoMovimiento.TRANSFERENCIA_ENTRADA) {
        return sum + movimiento.monto;
      } else {
        return sum - movimiento.monto;
      }
    }, 0);

    const saldoReal = totalComandas + totalMovimientos;

    return {
      caja,
      total: totalComandas,
      cantidadComandas: comandas.length,
      comandas: comandas.map(comanda => ({
        id: comanda.id,
        numero: comanda.numero,
        totalFinal: comanda.totalFinal,
        fecha: comanda.fecha,
        cliente: comanda.cliente.nombre,
      })),
      saldoReal,
    };
  }

  async crearMovimiento(
    movimientoDto: CrearMovimientoCajaDto,
    usuario: Personal,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MovimientoResult> {
    const { caja, tipoMovimiento, monto, observaciones, referencia } = movimientoDto;

    // Iniciar transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener balance actual
      const balanceCaja = await this.obtenerBalanceCaja(caja);
      const saldoAnterior = balanceCaja.saldoReal;

      // Calcular saldo posterior
      let saldoPosterior: number;
      if (tipoMovimiento === TipoMovimiento.INGRESO || tipoMovimiento === TipoMovimiento.TRANSFERENCIA_ENTRADA) {
        saldoPosterior = saldoAnterior + monto;
      } else {
        saldoPosterior = saldoAnterior - monto;
      }

      // Crear movimiento
      const movimiento = this.movimientoCajaRepository.create({
        caja,
        tipoMovimiento,
        monto,
        saldoAnterior,
        saldoPosterior,
        observaciones,
        referencia,
        usuario,
      });

      const movimientoGuardado = await queryRunner.manager.save(MovimientoCaja, movimiento);

      // Registrar en auditoría DENTRO de la transacción
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.CAJA_MOVIMIENTO,
        modulo: ModuloSistema.CAJA,
        descripcion: `Movimiento de ${tipoMovimiento} en ${caja} por $${monto}`,
        datosAnteriores: { saldoAnterior },
        datosNuevos: { saldoPosterior, movimiento: movimientoGuardado },
        observaciones,
        ipAddress,
        userAgent,
        usuario,
      }, queryRunner.manager);

      // Commit de la transacción
      await queryRunner.commitTransaction();

      return {
        success: true,
        saldoAnterior,
        saldoPosterior,
        movimiento: movimientoGuardado,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerMovimientos(
    caja?: Caja,
    tipoMovimiento?: TipoMovimiento,
    fechaInicio?: Date,
    fechaFin?: Date,
    limit = 50,
    offset = 0,
  ): Promise<{ movimientos: MovimientoCaja[]; total: number }> {
    const queryBuilder = this.movimientoCajaRepository
      .createQueryBuilder('movimiento')
      .leftJoinAndSelect('movimiento.usuario', 'usuario')
      .orderBy('movimiento.createdAt', 'DESC');

    if (caja) {
      queryBuilder.andWhere('movimiento.caja = :caja', { caja });
    }

    if (tipoMovimiento) {
      queryBuilder.andWhere('movimiento.tipoMovimiento = :tipoMovimiento', { tipoMovimiento });
    }

    if (fechaInicio) {
      queryBuilder.andWhere('movimiento.createdAt >= :fechaInicio', { fechaInicio });
    }

    if (fechaFin) {
      queryBuilder.andWhere('movimiento.createdAt <= :fechaFin', { fechaFin });
    }

    const [movimientos, total] = await queryBuilder
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { movimientos, total };
  }

  async transferirEntreCajas(
    transferirDto: TransferirCajaDto,
    usuario: Personal,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TransferenciaResult> {
    const { cajaOrigen, cajaDestino, monto, observaciones } = transferirDto;

    if (cajaOrigen === cajaDestino) {
      throw new BadRequestException('No se puede transferir a la misma caja');
    }

    // Obtener balance de la caja origen
    const balanceOrigen = await this.obtenerBalanceCaja(cajaOrigen);
    
    if (balanceOrigen.saldoReal < monto) {
      throw new BadRequestException(
        `Saldo insuficiente en ${cajaOrigen}. Disponible: $${balanceOrigen.saldoReal}, Solicitado: $${monto}`,
      );
    }

    // Iniciar transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let montoRestante = monto;
      let comandasTransferidas = 0;
      const comandasATransferir: Comanda[] = [];

      // Obtener comandas ordenadas por fecha (más antiguas primero)
      const comandas = await queryRunner.manager.find(Comanda, {
        where: {
          enCaja: cajaOrigen,
          estado: EstadoComanda.COMPLETADO,
        },
        order: { fecha: 'ASC' },
      });

      // Procesar comandas hasta completar el monto
      for (const comanda of comandas) {
        if (montoRestante <= 0) break;

        const montoComanda = comanda.totalFinal;
        if (montoComanda <= montoRestante) {
          // Transferir comanda completa
          comanda.enCaja = cajaDestino;
          comanda.observaciones = observaciones 
            ? `${comanda.observaciones || ''} - Transferido a ${cajaDestino}: ${observaciones}`
            : `${comanda.observaciones || ''} - Transferido a ${cajaDestino}`;
          
          await queryRunner.manager.save(Comanda, comanda);
          comandasATransferir.push(comanda);
          montoRestante -= montoComanda;
          comandasTransferidas++;
        } else {
          // No se puede transferir parcialmente, romper la transacción
          throw new BadRequestException(
            `No se puede transferir parcialmente la comanda ${comanda.numero}. Monto restante: $${montoRestante}, Comanda: $${montoComanda}`,
          );
        }
      }

      if (montoRestante > 0) {
        throw new BadRequestException(
          `No se pudo completar la transferencia. Monto restante: $${montoRestante}`,
        );
      }

      // Crear movimientos de transferencia
      const balanceOrigenFinal = await this.obtenerBalanceCaja(cajaOrigen);
      const balanceDestinoFinal = await this.obtenerBalanceCaja(cajaDestino);

      // Movimiento de salida en caja origen
      const movimientoSalida = this.movimientoCajaRepository.create({
        caja: cajaOrigen,
        tipoMovimiento: TipoMovimiento.TRANSFERENCIA_SALIDA,
        monto,
        saldoAnterior: balanceOrigenFinal.saldoReal,
        saldoPosterior: balanceOrigenFinal.saldoReal - monto,
        observaciones: `Transferencia a ${cajaDestino}: ${observaciones || ''}`,
        referencia: `TRANS-${Date.now()}`,
        usuario,
      });

      // Movimiento de entrada en caja destino
      const movimientoEntrada = this.movimientoCajaRepository.create({
        caja: cajaDestino,
        tipoMovimiento: TipoMovimiento.TRANSFERENCIA_ENTRADA,
        monto,
        saldoAnterior: balanceDestinoFinal.saldoReal,
        saldoPosterior: balanceDestinoFinal.saldoReal + monto,
        observaciones: `Transferencia desde ${cajaOrigen}: ${observaciones || ''}`,
        referencia: `TRANS-${Date.now()}`,
        usuario,
      });

      await queryRunner.manager.save(MovimientoCaja, [movimientoSalida, movimientoEntrada]);

      // Generar PDF
      const pdfBuffer = await this.generarPDFTransferencia(
        cajaOrigen,
        cajaDestino,
        monto,
        comandasATransferir,
        observaciones,
        usuario.id,
      );

      // Registrar en auditoría DENTRO de la transacción
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.CAJA_TRANSFERENCIA,
        modulo: ModuloSistema.CAJA,
        descripcion: `Transferencia de $${monto} desde ${cajaOrigen} a ${cajaDestino}`,
        datosAnteriores: { 
          balanceOrigen: balanceOrigenFinal.saldoReal,
          balanceDestino: balanceDestinoFinal.saldoReal,
        },
        datosNuevos: { 
          comandasTransferidas,
          movimientoSalida: movimientoSalida.id,
          movimientoEntrada: movimientoEntrada.id,
        },
        observaciones,
        ipAddress,
        userAgent,
        usuario,
      }, queryRunner.manager);

      // Commit de la transacción
      await queryRunner.commitTransaction();

      return {
        success: true,
        montoTransferido: monto,
        comandasTransferidas,
        pdfBuffer,
      };

    } catch (error) {
      // Rollback en caso de error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async generarPDFTransferencia(
    cajaOrigen: Caja,
    cajaDestino: Caja,
    monto: number,
    comandas: Comanda[],
    observaciones: string | undefined,
    usuarioId: string,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const lineHeight = fontSize * 1.2;

    let y = height - 50;

    // Título
    page.drawText('REPORTE DE TRANSFERENCIA ENTRE CAJAS', {
      x: 50,
      y,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight * 2;

    // Información de la transferencia
    page.drawText(`Fecha: ${new Date().toLocaleString('es-AR')}`, {
      x: 50,
      y,
      size: fontSize,
      font,
    });
    y -= lineHeight;

    page.drawText(`Caja Origen: ${cajaOrigen}`, {
      x: 50,
      y,
      size: fontSize,
      font,
    });
    y -= lineHeight;

    page.drawText(`Caja Destino: ${cajaDestino}`, {
      x: 50,
      y,
      size: fontSize,
      font,
    });
    y -= lineHeight;

    page.drawText(`Monto Transferido: $${monto.toFixed(2)}`, {
      x: 50,
      y,
      size: fontSize,
      font,
    });
    y -= lineHeight;

    if (observaciones) {
      page.drawText(`Observaciones: ${observaciones}`, {
        x: 50,
        y,
        size: fontSize,
        font,
      });
      y -= lineHeight * 2;
    }

    // Tabla de comandas
    page.drawText('Comandas Transferidas:', {
      x: 50,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;

    // Encabezados de tabla
    const headers = ['Número', 'Fecha', 'Cliente', 'Monto'];
    const columnWidths = [100, 100, 200, 100];
    let x = 50;

    headers.forEach((header, index) => {
      page.drawText(header, {
        x,
        y,
        size: fontSize - 2,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      x += columnWidths[index];
    });
    y -= lineHeight;

    // Datos de comandas
    for (const comanda of comandas) {
      if (y < 100) {
        // Nueva página si no hay espacio
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }

      x = 50;
      page.drawText(comanda.numero, { x, y, size: fontSize - 2, font });
      x += columnWidths[0];

      page.drawText(comanda.fecha.toLocaleDateString('es-AR'), { x, y, size: fontSize - 2, font });
      x += columnWidths[1];

      page.drawText(comanda.cliente.nombre, { x, y, size: fontSize - 2, font });
      x += columnWidths[2];

      page.drawText(`$${comanda.totalFinal.toFixed(2)}`, { x, y, size: fontSize - 2, font });
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
} 