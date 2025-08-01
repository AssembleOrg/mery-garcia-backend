import { 
  Injectable, 
  NotFoundException, 
  Logger, 
  BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Movimiento } from '../entities/movimiento.entity';
import { Comanda, EstadoDeComanda } from '../entities/Comanda.entity';
import { Personal } from '../../personal/entities/Personal.entity';
import { 
  CrearMovimientoDto, 
  ActualizarMovimientoDto, 
  FiltrarMovimientosDto 
} from '../dto/movimiento.dto';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { TipoAccion } from '../../enums/TipoAccion.enum';
import { ModuloSistema } from '../../enums/ModuloSistema.enum';

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
    private auditoriaService: AuditoriaService,
    private dataSource: DataSource,
  ) {}

  async crear(dto: CrearMovimientoDto): Promise<Movimiento> {
    /* ───── Validaciones de entrada ───── */
    if (!dto.personalId) {
      throw new BadRequestException('El personal es requerido');
    }
    if (!dto.comandasValidadasIds?.length) {
      throw new BadRequestException('Las comandas validadas son requeridas');
    }

    /* ───── Transacción ───── */
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    console.log(dto);
    try {
      /* 1. Insertar el movimiento */
      const movimiento = await qr.manager.save(Movimiento, {
        montoARS:     dto.montoARS,
        montoUSD:     dto.montoUSD,
        residualARS:  dto.residualARS,
        residualUSD:  dto.residualUSD,
        personal:     { id: dto.personalId } as Personal, // stub: evita 1 SELECT
      });

      /* 2. Vincular y traspasar comandas en un UPDATE */
      await qr.manager
        .createQueryBuilder()
        .update(Comanda)
        .set({
          movimiento,                              // FK
          estadoDeComanda: EstadoDeComanda.TRASPASADA,
        })
        .where({ id: In(dto.comandasValidadasIds) })
        .execute();

      await qr.commitTransaction();

      /* 3. Devolver el movimiento con sus comandas */
      return this.obtenerPorId(movimiento.id);     // método ya existente
    } catch (err) {
      await qr.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await qr.release();
    }
  }

  async obtenerTodos(filtros?: FiltrarMovimientosDto): Promise<MovimientosPaginados> {
    try {
      const page = filtros?.page || 1;
      const limit = filtros?.limit || 20;
      const skip = (page - 1) * limit;
      const orderBy = filtros?.orderBy || 'createdAt';
      const orderDirection = filtros?.orderDirection || 'DESC';

      const queryBuilder = this.movimientoRepository
        .createQueryBuilder('movimiento')
        .leftJoinAndSelect('movimiento.comanda', 'comanda')
        .leftJoinAndSelect('movimiento.personal', 'personal');

      // Aplicar filtros
      this.aplicarFiltros(queryBuilder, filtros);

      // Aplicar ordenamiento
      const camposPermitidos = ['monto', 'residual', 'createdAt'];
      const campoOrdenamiento = camposPermitidos.includes(orderBy) ? orderBy : 'createdAt';
      queryBuilder.orderBy(`movimiento.${campoOrdenamiento}`, orderDirection as 'ASC' | 'DESC');

      const [movimientos, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

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
      };
    } catch (error) {
      this.logger.error(`Error obteniendo movimientos: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorId(id: string): Promise<Movimiento> {
    try {
      const movimiento = await this.movimientoRepository.findOne({
        where: { id },
        relations: ['comandas', 'personal']
      });

      if (!movimiento) {
        throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
      }

      return movimiento;
    } catch (error) {
      this.logger.error(`Error obteniendo movimiento por ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async actualizar(id: string, actualizarDto: ActualizarMovimientoDto): Promise<Movimiento> {
    try {
      const movimiento = await this.obtenerPorId(id);

      // Verificar que la comanda existe si se está actualizando
      if (actualizarDto.comandasValidadasIds) {
        const comanda = await this.comandaRepository.findOne({
          where: { id: In(actualizarDto.comandasValidadasIds) }
        });

        if (!comanda) {
          throw new NotFoundException(`Comanda con ID ${actualizarDto.comandasValidadasIds} no encontrada`);
        }
      }

      // Verificar que el personal existe si se está actualizando
      if (actualizarDto.personalId) {
        const personal = await this.personalRepository.findOne({
          where: { id: actualizarDto.personalId }
        });

        if (!personal) {
          throw new NotFoundException(`Personal con ID ${actualizarDto.personalId} no encontrado`);
        }
      }

      Object.assign(movimiento, actualizarDto);
      const actualizado = await this.movimientoRepository.save(movimiento);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: actualizado.id,
        descripcion: `Movimiento actualizado: $${actualizado.montoARS}`,
      });

      this.logger.log(`Movimiento actualizado: ${actualizado.id} - $${actualizado.montoARS}`);
      return actualizado;
    } catch (error) {
      this.logger.error(`Error actualizando movimiento: ${error.message}`, error.stack);
      throw error;
    }
  }

  async eliminar(id: string): Promise<void> {
    try {
      const movimiento = await this.obtenerPorId(id);
      await this.movimientoRepository.softRemove(movimiento);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_ELIMINADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: movimiento.id,
        descripcion: `Movimiento eliminado: $${movimiento.montoARS}`,
      });

      this.logger.log(`Movimiento eliminado: ${id}`);
    } catch (error) {
      this.logger.error(`Error eliminando movimiento: ${error.message}`, error.stack);
      throw error;
    }
  }

  async restaurar(id: string): Promise<Movimiento> {
    try {
      const movimiento = await this.movimientoRepository.findOne({
        where: { id },
        withDeleted: true
      });

      if (!movimiento) {
        throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
      }

      await this.movimientoRepository.restore(id);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: movimiento.id,
        descripcion: `Movimiento restaurado: $${movimiento.montoARS}`,
      });

      this.logger.log(`Movimiento restaurado: ${id}`);
      return await this.obtenerPorId(id);
    } catch (error) {
      this.logger.error(`Error restaurando movimiento: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorComanda(comandaId: string): Promise<Movimiento[]> {
    try {
      return await this.movimientoRepository.find({
        where: { comandas: { id: comandaId } },
        relations: ['personal'],
        order: {}
      });
    } catch (error) {
      this.logger.error(`Error obteniendo movimientos por comanda: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorPersonal(personalId: string): Promise<Movimiento[]> {
    try {
      return await this.movimientoRepository.find({
        where: { personal: { id: personalId } },
        relations: ['comanda'],
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo movimientos por personal: ${error.message}`, error.stack);
      throw error;
    }
  }

  private aplicarFiltros(queryBuilder: SelectQueryBuilder<Movimiento>, filtros?: FiltrarMovimientosDto): void {
    if (filtros?.comandaId) {
      queryBuilder.andWhere('movimiento.comandaId = :comandaId', { comandaId: filtros.comandaId });
    }

    if (filtros?.personalId) {
      queryBuilder.andWhere('movimiento.personalId = :personalId', { personalId: filtros.personalId });
    }

    if (filtros?.montoMinimo !== undefined) {
      queryBuilder.andWhere('movimiento.monto >= :montoMinimo', { montoMinimo: filtros.montoMinimo });
    }

    if (filtros?.montoMaximo !== undefined) {
      queryBuilder.andWhere('movimiento.monto <= :montoMaximo', { montoMaximo: filtros.montoMaximo });
    }
  }
} 