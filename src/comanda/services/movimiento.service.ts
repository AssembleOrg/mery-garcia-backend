import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Raw, Repository, SelectQueryBuilder } from 'typeorm';
import { Movimiento } from '../entities/movimiento.entity';
import { Comanda, EstadoDeComanda, Caja } from '../entities/Comanda.entity';
import { Personal } from '../../personal/entities/Personal.entity';
import { Egreso } from '../entities/egreso.entity';
import {
  CrearMovimientoDto,
  ActualizarMovimientoDto,
  FiltrarMovimientosDto,
} from '../dto/movimiento.dto';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { TipoAccion } from '../../enums/TipoAccion.enum';
import { ModuloSistema } from '../../enums/ModuloSistema.enum';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';
import { TipoPago } from 'src/enums/TipoPago.enum';

export interface MovimientosPaginados {
  data: Movimiento[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  netoEfectivo?: {
    ARS: number;
    USD: number;
  };
}

@Injectable()
export class MovimientoService {
  private readonly logger = new Logger(MovimientoService.name);

  constructor(
    @InjectRepository(Movimiento)
    private movimientoRepository: Repository<Movimiento>,
    @InjectRepository(Comanda)
    private comandaRepository: Repository<Comanda>,
    @InjectRepository(Personal)
    private personalRepository: Repository<Personal>,
    @InjectRepository(PrepagoGuardado)
    private prepagoGuardadoRepository: Repository<PrepagoGuardado>,
    @InjectRepository(Egreso)
    private egresoRepository: Repository<Egreso>,
    private auditoriaService: AuditoriaService,
    private dataSource: DataSource,
  ) {}

  async crear(dto: CrearMovimientoDto): Promise<Movimiento> {
    const newComentario = dto.comentario || '';
    /* ───── Validaciones de entrada ───── */
    if (!dto.personalId) {
      throw new BadRequestException('El personal es requerido');
    }
    if (!dto.comandasValidadasIds?.length && !newComentario.length) {
      throw new BadRequestException(
        'Las comandas validadas o comentario son requeridos',
      );
    }

    /* ───── Transacción ───── */
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    console.log(dto);
    try {
      /* 1. Insertar el movimiento */
      const movimiento = await qr.manager.save(Movimiento, {
        montoARS: dto.montoARS,
        montoUSD: dto.montoUSD,
        residualARS: dto.residualARS,
        residualUSD: dto.residualUSD,
        comentario: newComentario,
        efectivoARS: newComentario.includes("Egreso generado desde CAJA_1") ? 0 : dto.efectivoARS,
        efectivoUSD: newComentario.includes("Egreso generado desde CAJA_1") ? 0 : dto.efectivoUSD,
        esIngreso: dto.esIngreso ?? true, // Por defecto true si no se especifica
        personal: { id: dto.personalId } as Personal, // stub: evita 1 SELECT
      });

      /* 2. Vincular y traspasar comandas en un UPDATE solo si hay comandas */
      if (dto.comandasValidadasIds && dto.comandasValidadasIds.length > 0) {
        await qr.manager
          .createQueryBuilder()
          .update(Comanda)
          .set({
            movimiento, // FK
            estadoDeComanda: EstadoDeComanda.TRASPASADA,
          })
          .where({ id: In(dto.comandasValidadasIds) })
          .execute();
      }

      const comandas = await qr.manager.find(Comanda, {
        where: { id: In(dto.comandasValidadasIds) },
        relations: ['prepagoARS', 'prepagoUSD'],
      });

      for (const comanda of comandas) {
        if (comanda.prepagoARS) {
          // Calcular el nuevo monto traspasado
          const nuevoMontoTraspasado = Number(comanda.prepagoARS.montoTraspasado ?? 0) + Number(comanda.prepagoARS.monto);
          
          // Limitar al monto original del prepago
          const montoTraspasadoFinal = Math.min(nuevoMontoTraspasado, Number(comanda.prepagoARS.monto));
          
          await qr.manager.update(PrepagoGuardado, comanda.prepagoARS.id, {
            montoTraspasado: montoTraspasadoFinal,
          });
        }
        if (comanda.prepagoUSD) {
          // Calcular el nuevo monto traspasado
          const nuevoMontoTraspasado = Number(comanda.prepagoUSD.montoTraspasado ?? 0) + Number(comanda.prepagoUSD.monto);
          
          // Limitar al monto original del prepago
          const montoTraspasadoFinal = Math.min(nuevoMontoTraspasado, Number(comanda.prepagoUSD.monto));
          
          await qr.manager.update(PrepagoGuardado, comanda.prepagoUSD.id, {
            montoTraspasado: montoTraspasadoFinal,
          });
        }
      }

      //Update señas activas
      const prepagosGuardados = await qr.manager.find(PrepagoGuardado, {
        where: {
          estado: EstadoPrepago.ACTIVA,
        },
      });
      prepagosGuardados.forEach((pg) => {
        pg.montoTraspasado = Math.min(
          Number(pg.montoTraspasado ?? 0) + Number(pg.monto ?? 0),
          Number(pg.monto),
        );
      });
      await qr.manager.save(PrepagoGuardado, prepagosGuardados);

      await qr.commitTransaction();

      /* 3. Devolver el movimiento con sus comandas */
      return this.obtenerPorId(movimiento.id); // método ya existente
    } catch (err) {
      await qr.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await qr.release();
    }
  }

  async obtenerTodos(
    filtros: FiltrarMovimientosDto,
  ): Promise<MovimientosPaginados> {
    try {
      const page = filtros?.page || 1;
      const limit = filtros?.limit || 20;
      const skip = (page - 1) * limit;
      const orderBy = filtros?.orderBy || 'createdAt';
      const orderDirection = filtros?.orderDirection || 'DESC';

      const queryBuilder = this.movimientoRepository
        .createQueryBuilder('movimiento')
        .leftJoinAndSelect('movimiento.comandas', 'comandas')
        .leftJoinAndSelect('movimiento.personal', 'personal');

      // Aplicar filtros
      this.aplicarFiltros(queryBuilder, filtros);

      // Aplicar ordenamiento
      const camposPermitidos = ['monto', 'residual', 'createdAt'];
      const campoOrdenamiento = camposPermitidos.includes(orderBy)
        ? orderBy
        : 'createdAt';
      queryBuilder.orderBy(
        `movimiento.${campoOrdenamiento}`,
        orderDirection as 'ASC' | 'DESC',
      );

      if (filtros.fechaDesde && filtros.fechaHasta) {
        // El frontend envía fechas en formato Argentina (UTC-3)
        // Ejemplo: 2025-12-02T03:00:00.000Z = medianoche del 2 de diciembre en Argentina
        // Usamos fechaDesde tal cual viene (ya es el inicio del día en Argentina)
        const fechaDesde = new Date(filtros.fechaDesde);
        
        // Para fechaHasta, necesitamos sumar casi 24 horas para llegar al final del día en Argentina
        // Si fechaHasta es 2025-12-02T03:00:00.000Z (medianoche Argentina del día 2)
        // Queremos hasta 2025-12-03T02:59:59.999Z (23:59:59.999 Argentina del día 2)
        const fechaHastaRaw = new Date(filtros.fechaHasta);
        const fechaHasta = new Date(fechaHastaRaw.getTime() + (24 * 60 * 60 * 1000) - 1);
        
        console.log('\n📅 Filtros de fecha (Argentina UTC-3):');
        console.log(`   fechaDesde (original): ${filtros.fechaDesde}`);
        console.log(`   fechaDesde (usada): ${fechaDesde.toISOString()}`);
        console.log(`   fechaHasta (original): ${filtros.fechaHasta}`);
        console.log(`   fechaHasta (usada): ${fechaHasta.toISOString()}`);
        
        queryBuilder.andWhere('movimiento.createdAt >= :fechaDesde', {
          fechaDesde,
        });
        queryBuilder.andWhere('movimiento.createdAt <= :fechaHasta', {
          fechaHasta,
        });
      }

      const [movimientos, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      console.log('Movimientos:', movimientos.length);

      // Calcular neto de efectivo usando los campos efectivoARS y efectivoUSD de los movimientos
      let netoEfectivo: { ARS: number; USD: number } | undefined;

      //filter movimientos
      const movEgresosCaja2 = movimientos.filter(mov => mov.comentario?.includes('Egreso generado desde CAJA_1'));
      
      if (filtros.fechaDesde && filtros.fechaHasta) {
        // Sumar directamente los campos efectivoARS y efectivoUSD de los movimientos filtrados
        netoEfectivo = {
          ARS: movimientos.reduce((sum, mov) => sum + (mov.efectivoARS ? Number(mov.efectivoARS) : 0), 0) - movEgresosCaja2.reduce((sum, mov) => sum + (mov.efectivoARS ? Number(mov.montoARS) : 0), 0),
          USD: movimientos.reduce((sum, mov) => sum + (mov.efectivoUSD ? Number(mov.efectivoUSD) : 0), 0) - movEgresosCaja2.reduce((sum, mov) => sum + (mov.efectivoUSD ? Number(mov.montoUSD) : 0), 0),
        };
        
        console.log('\n📊 Cálculo netoEfectivo desde campos de movimientos:');
        console.log(`   Total movimientos en período: ${movimientos.length}`);
        console.log(`   Movimientos con efectivoARS > 0: ${movimientos.filter(mov => mov.efectivoARS > 0).length}`);
        console.log(`   Movimientos con efectivoUSD > 0: ${movimientos.filter(mov => mov.efectivoUSD > 0).length}`);
        console.log(`   Neto efectivo ARS: ${netoEfectivo.ARS}`);
        console.log(`   Neto efectivo USD: ${netoEfectivo.USD}`);
      }

      return {
        data: movimientos,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
        },
        netoEfectivo,
      };
    } catch (error) {
      this.logger.error(
        `Error obteniendo movimientos: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async obtenerPorId(id: string): Promise<Movimiento> {
    try {
      const movimiento = await this.movimientoRepository.findOne({
        where: { id },
        relations: ['comandas', 'personal'],
      });

      if (!movimiento) {
        throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
      }

      return movimiento;
    } catch (error) {
      this.logger.error(
        `Error obteniendo movimiento por ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async actualizar(
    id: string,
    actualizarDto: ActualizarMovimientoDto,
  ): Promise<Movimiento> {
    try {
      const movimiento = await this.obtenerPorId(id);

      // Verificar que la comanda existe si se está actualizando
      if (actualizarDto.comandasValidadasIds) {
        const comanda = await this.comandaRepository.findOne({
          where: { id: In(actualizarDto.comandasValidadasIds) },
        });

        if (!comanda) {
          throw new NotFoundException(
            `Comanda con ID ${actualizarDto.comandasValidadasIds} no encontrada`,
          );
        }
      }

      // Verificar que el personal existe si se está actualizando
      if (actualizarDto.personalId) {
        const personal = await this.personalRepository.findOne({
          where: { id: actualizarDto.personalId },
        });

        if (!personal) {
          throw new NotFoundException(
            `Personal con ID ${actualizarDto.personalId} no encontrado`,
          );
        }
      }

      Object.assign(movimiento, actualizarDto);
      const actualizado = await this.movimientoRepository.save(movimiento);

      this.logger.log(
        `Movimiento actualizado: ${actualizado.id} - $${actualizado.montoARS}`,
      );
      return actualizado;
    } catch (error) {
      this.logger.error(
        `Error actualizando movimiento: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async eliminar(id: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1. Obtener el movimiento con sus comandas y prepagos
      const movimiento = await qr.manager.findOne(Movimiento, {
        where: { id },
        relations: ['comandas', 'comandas.prepagoARS', 'comandas.prepagoUSD'],
      });

      if (!movimiento) {
        throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
      }

      const comandas = movimiento.comandas || [];
      console.log(`📦 Revertiendo ${comandas.length} comandas asociadas al movimiento ${id}`);

      // 2. Revertir comandas: cambiar estado a VALIDADO y quitar relación con movimiento
      if (comandas.length > 0) {
        const comandaIds = comandas.map((c) => c.id);
        await qr.manager
          .createQueryBuilder()
          .update(Comanda)
          .set({
            movimiento: null,
            estadoDeComanda: EstadoDeComanda.VALIDADO,
          })
          .where({ id: In(comandaIds) })
          .execute();

        console.log(`✅ ${comandas.length} comandas revertidas a estado VALIDADO`);
      }

      // 3. Revertir cambios en prepagos asociados a comandas
      const prepagosAfectados = new Set<string>();
      for (const comanda of comandas) {
        if (comanda.prepagoARS) {
          prepagosAfectados.add(comanda.prepagoARS.id);
        }
        if (comanda.prepagoUSD) {
          prepagosAfectados.add(comanda.prepagoUSD.id);
        }
      }

      // Obtener prepagos para revertir montoTraspasado
      if (prepagosAfectados.size > 0) {
        const prepagos = await qr.manager.find(PrepagoGuardado, {
          where: { id: In(Array.from(prepagosAfectados)) },
        });

        for (const prepago of prepagos) {
          const montoPrepago = Number(prepago.monto ?? 0);
          const montoTraspasadoActual = Number(prepago.montoTraspasado ?? 0);
          
          // Restar el monto del prepago del montoTraspasado
          const nuevoMontoTraspasado = Math.max(0, montoTraspasadoActual - montoPrepago);
          
          await qr.manager.update(PrepagoGuardado, prepago.id, {
            montoTraspasado: nuevoMontoTraspasado,
          });

          console.log(
            `✅ Prepago ${prepago.id.substring(0, 8)}...: montoTraspasado ${montoTraspasadoActual} → ${nuevoMontoTraspasado}`,
          );
        }
      }

      // Nota: No revertimos los prepagos activos generales porque:
      // 1. No podemos saber si fueron afectados solo por este movimiento o por otros
      // 2. Solo revertimos los prepagos específicos asociados a las comandas del movimiento

      // 5. Eliminar el movimiento (hard delete)
      await qr.manager.delete(Movimiento, { id });

      await qr.commitTransaction();
      this.logger.log(`Movimiento ${id} eliminado y cambios revertidos exitosamente`);
    } catch (error) {
      await qr.rollbackTransaction();
      this.logger.error(
        `Error eliminando movimiento: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await qr.release();
    }
  }

  async restaurar(id: string): Promise<Movimiento> {
    try {
      const movimiento = await this.movimientoRepository.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!movimiento) {
        throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
      }

      await this.movimientoRepository.restore(id);

      this.logger.log(`Movimiento restaurado: ${id}`);
      return await this.obtenerPorId(id);
    } catch (error) {
      this.logger.error(
        `Error restaurando movimiento: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async obtenerPorComanda(comandaId: string): Promise<Movimiento[]> {
    try {
      return await this.movimientoRepository.find({
        where: { comandas: { id: comandaId } },
        relations: ['personal'],
        order: {},
      });
    } catch (error) {
      this.logger.error(
        `Error obteniendo movimientos por comanda: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async obtenerPorPersonal(personalId: string): Promise<Movimiento[]> {
    try {
      return await this.movimientoRepository.find({
        where: { personal: { id: personalId } },
        relations: ['comanda'],
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Error obteniendo movimientos por personal: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private aplicarFiltros(
    queryBuilder: SelectQueryBuilder<Movimiento>,
    filtros?: FiltrarMovimientosDto,
  ): void {
    if (filtros?.personalId) {
      queryBuilder.andWhere('movimiento.personalId = :personalId', {
        personalId: filtros.personalId,
      });
    }
  }
}
