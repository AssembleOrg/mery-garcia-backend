import { 
  Injectable, 
  NotFoundException, 
  ConflictException,
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UnidadNegocio } from '../entities/unidadNegocio.entity';
import { 
  CrearUnidadNegocioDto, 
  ActualizarUnidadNegocioDto, 
  FiltrarUnidadesNegocioDto 
} from '../dto/unidad-negocio.dto';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { TipoAccion } from '../../enums/TipoAccion.enum';
import { ModuloSistema } from '../../enums/ModuloSistema.enum';

export interface UnidadesNegocioPaginadas {
  data: UnidadNegocio[];
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
export class UnidadNegocioService {
  private readonly logger = new Logger(UnidadNegocioService.name);

  constructor(
    @InjectRepository(UnidadNegocio)
    private unidadNegocioRepository: Repository<UnidadNegocio>,
    private auditoriaService: AuditoriaService,
  ) {}

  async crear(crearUnidadNegocioDto: CrearUnidadNegocioDto): Promise<UnidadNegocio> {
    try {
      // Verificar si ya existe una unidad de negocio con el mismo nombre
      const existente = await this.unidadNegocioRepository.findOne({
        where: { nombre: crearUnidadNegocioDto.nombre },
        withDeleted: true
      });

      if (existente && !existente.deletedAt) {
        throw new ConflictException(`Ya existe una unidad de negocio con el nombre "${crearUnidadNegocioDto.nombre}"`);
      }

      const unidadNegocio = this.unidadNegocioRepository.create(crearUnidadNegocioDto);
      const guardado = await this.unidadNegocioRepository.save(unidadNegocio);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_CREADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: guardado.id,
        descripcion: `Unidad de negocio creada: ${guardado.nombre}`,
      });

      this.logger.log(`Unidad de negocio creada: ${guardado.id} - ${guardado.nombre}`);
      return guardado;
    } catch (error) {
      this.logger.error(`Error creando unidad de negocio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerTodos(filtros?: FiltrarUnidadesNegocioDto): Promise<UnidadesNegocioPaginadas> {
    try {
      const page = filtros?.page || 1;
      const limit = filtros?.limit || 20;
      const skip = (page - 1) * limit;
      const orderBy = filtros?.orderBy || 'nombre';
      const orderDirection = filtros?.orderDirection || 'ASC';

      const queryBuilder = this.unidadNegocioRepository
        .createQueryBuilder('unidadNegocio')
        .leftJoinAndSelect('unidadNegocio.productosServicios', 'productosServicios');

      // Aplicar filtros
      this.aplicarFiltros(queryBuilder, filtros);

      // Aplicar ordenamiento
      const camposPermitidos = ['nombre', 'createdAt'];
      const campoOrdenamiento = camposPermitidos.includes(orderBy) ? orderBy : 'nombre';
      queryBuilder.orderBy(`unidadNegocio.${campoOrdenamiento}`, orderDirection as 'ASC' | 'DESC');

      const [unidadesNegocio, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

      return {
        data: unidadesNegocio,
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
      this.logger.error(`Error obteniendo unidades de negocio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorId(id: string): Promise<UnidadNegocio> {
    try {
      const unidadNegocio = await this.unidadNegocioRepository.findOne({
        where: { id },
        relations: ['productosServicios']
      });

      if (!unidadNegocio) {
        throw new NotFoundException(`Unidad de negocio con ID ${id} no encontrada`);
      }

      return unidadNegocio;
    } catch (error) {
      this.logger.error(`Error obteniendo unidad de negocio por ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async actualizar(id: string, actualizarDto: ActualizarUnidadNegocioDto): Promise<UnidadNegocio> {
    try {
      const unidadNegocio = await this.obtenerPorId(id);

      // Verificar nombre único si se está actualizando
      if (actualizarDto.nombre && actualizarDto.nombre !== unidadNegocio.nombre) {
        const existente = await this.unidadNegocioRepository.findOne({
          where: { nombre: actualizarDto.nombre },
          withDeleted: true
        });

        if (existente && existente.id !== id && !existente.deletedAt) {
          throw new ConflictException(`Ya existe una unidad de negocio con el nombre "${actualizarDto.nombre}"`);
        }
      }

      Object.assign(unidadNegocio, actualizarDto);
      const actualizado = await this.unidadNegocioRepository.save(unidadNegocio);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: actualizado.id,
        descripcion: `Unidad de negocio actualizada: ${actualizado.nombre}`,
      });

      this.logger.log(`Unidad de negocio actualizada: ${actualizado.id} - ${actualizado.nombre}`);
      return actualizado;
    } catch (error) {
      this.logger.error(`Error actualizando unidad de negocio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async eliminar(id: string): Promise<void> {
    try {
      const unidadNegocio = await this.obtenerPorId(id);
      await this.unidadNegocioRepository.softRemove(unidadNegocio);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_ELIMINADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: unidadNegocio.id,
        descripcion: `Unidad de negocio eliminada: ${unidadNegocio.nombre}`,
      });

      this.logger.log(`Unidad de negocio eliminada: ${id}`);
    } catch (error) {
      this.logger.error(`Error eliminando unidad de negocio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async restaurar(id: string): Promise<UnidadNegocio> {
    try {
      const unidadNegocio = await this.unidadNegocioRepository.findOne({
        where: { id },
        withDeleted: true
      });

      if (!unidadNegocio) {
        throw new NotFoundException(`Unidad de negocio con ID ${id} no encontrada`);
      }

      await this.unidadNegocioRepository.restore(id);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: unidadNegocio.id,
        descripcion: `Unidad de negocio restaurada: ${unidadNegocio.nombre}`,
      });

      this.logger.log(`Unidad de negocio restaurada: ${id}`);
      return await this.obtenerPorId(id);
    } catch (error) {
      this.logger.error(`Error restaurando unidad de negocio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerTodas(): Promise<UnidadNegocio[]> {
    try {
      return await this.unidadNegocioRepository.find({
        relations: ['productosServicios'],
        order: { nombre: 'ASC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo todas las unidades de negocio: ${error.message}`, error.stack);
      throw error;
    }
  }

  private aplicarFiltros(queryBuilder: SelectQueryBuilder<UnidadNegocio>, filtros?: FiltrarUnidadesNegocioDto): void {
    if (filtros?.nombre) {
      queryBuilder.andWhere('unidadNegocio.nombre ILIKE :nombre', { nombre: `%${filtros.nombre}%` });
    }
  }
} 