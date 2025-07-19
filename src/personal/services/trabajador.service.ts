import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ConflictException,
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Trabajador } from '../entities/Trabajador.entity';
import { RolTrabajador } from 'src/enums/RolTrabajador.enum';
import { 
  CrearTrabajadorDto, 
  ActualizarTrabajadorDto, 
  FiltrarTrabajadoresDto 
} from '../dto/trabajador.dto';

export interface TrabajadoresPaginados {
  trabajadores: Trabajador[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TrabajadorService {
  private readonly logger = new Logger(TrabajadorService.name);

  constructor(
    @InjectRepository(Trabajador)
    private trabajadorRepository: Repository<Trabajador>,
  ) {}

  async crear(crearTrabajadorDto: CrearTrabajadorDto): Promise<Trabajador> {
    try {
      // Verificar si ya existe un trabajador con el mismo nombre
      const trabajadorExistente = await this.trabajadorRepository.findOne({
        where: { nombre: crearTrabajadorDto.nombre },
        withDeleted: true
      });

      if (trabajadorExistente && !trabajadorExistente.deletedAt) {
        throw new ConflictException(`Ya existe un trabajador con el nombre "${crearTrabajadorDto.nombre}"`);
      }

      const trabajador = this.trabajadorRepository.create(crearTrabajadorDto);
      const trabajadorGuardado = await this.trabajadorRepository.save(trabajador);

      this.logger.log(`Trabajador creado: ${trabajadorGuardado.id} - ${trabajadorGuardado.nombre}`);
      return trabajadorGuardado;
    } catch (error) {
      this.logger.error(`Error creando trabajador: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerTodosSinPaginacion(): Promise<Trabajador[]> {
    try {
      return await this.trabajadorRepository.find({
        where: { },
        order: { nombre: 'ASC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo trabajadores: ${error.message}`, error.stack);
      throw new BadRequestException('Error al obtener los trabajadores');
    }
  }

  async obtenerTodos(filtros?: FiltrarTrabajadoresDto): Promise<TrabajadoresPaginados> {
    try {
      const page = filtros?.page || 1;
      const limit = filtros?.limit || 20;
      const offset = (page - 1) * limit;
      const orderBy = filtros?.orderBy || 'nombre';
      const orderDirection = filtros?.orderDirection || 'ASC';

      const where: FindOptionsWhere<Trabajador> = {};

      // Aplicar filtros
      if (filtros?.nombre) {
        where.nombre = Like(`%${filtros.nombre}%`);
      }

      if (filtros?.rol) {
        where.rol = filtros.rol;
      }

      if (filtros?.activo !== undefined) {
        where.activo = filtros.activo;
      }

      const [trabajadores, total] = await this.trabajadorRepository.findAndCount({
        where,
        order: { [orderBy]: orderDirection },
        skip: offset,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        trabajadores,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo trabajadores: ${error.message}`, error.stack);
      throw new BadRequestException('Error al obtener los trabajadores');
    }
  }

  async obtenerTodas(): Promise<Trabajador[]> {
    return this.trabajadorRepository.find({
      where: {},
      relations: ['items']
    });
  }

  async obtenerPorId(id: string): Promise<Trabajador> {
    try {
      const trabajador = await this.trabajadorRepository.findOne({
        where: { id },
        relations: ['items']
      });

      if (!trabajador) {
        throw new NotFoundException(`Trabajador con ID ${id} no encontrado`);
      }

      return trabajador;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error obteniendo trabajador por ID: ${error.message}`, error.stack);
      throw new BadRequestException('Error al obtener el trabajador');
    }
  }

  async actualizar(id: string, actualizarTrabajadorDto: ActualizarTrabajadorDto): Promise<Trabajador> {
    try {
      const trabajador = await this.obtenerPorId(id);

      // Verificar si se está cambiando el nombre y ya existe otro trabajador con ese nombre
      if (actualizarTrabajadorDto.nombre && actualizarTrabajadorDto.nombre !== trabajador.nombre) {
        const trabajadorExistente = await this.trabajadorRepository.findOne({
          where: { nombre: actualizarTrabajadorDto.nombre },
          withDeleted: true
        });

        if (trabajadorExistente && trabajadorExistente.id !== id && !trabajadorExistente.deletedAt) {
          throw new ConflictException(`Ya existe un trabajador con el nombre "${actualizarTrabajadorDto.nombre}"`);
        }
      }

      // Aplicar las actualizaciones
      Object.assign(trabajador, actualizarTrabajadorDto);
      
      const trabajadorActualizado = await this.trabajadorRepository.save(trabajador);

      this.logger.log(`Trabajador actualizado: ${trabajadorActualizado.id} - ${trabajadorActualizado.nombre}`);
      return trabajadorActualizado;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error actualizando trabajador: ${error.message}`, error.stack);
      throw new BadRequestException('Error al actualizar el trabajador');
    }
  }

  async eliminar(id: string): Promise<void> {
    try {
      const trabajador = await this.obtenerPorId(id);

      // Verificar si el trabajador está siendo usado en alguna relación
      // TODO: Agregar verificaciones según las relaciones que pueda tener

      await this.trabajadorRepository.softDelete(id);

      this.logger.log(`Trabajador eliminado (soft delete): ${id} - ${trabajador.nombre}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error eliminando trabajador: ${error.message}`, error.stack);
      throw new BadRequestException('Error al eliminar el trabajador');
    }
  }

  async restaurar(id: string): Promise<Trabajador> {
    try {
      const trabajador = await this.trabajadorRepository.findOne({
        where: { id },
        withDeleted: true
      });

      if (!trabajador) {
        throw new NotFoundException(`Trabajador con ID ${id} no encontrado`);
      }

      if (!trabajador.deletedAt) {
        throw new BadRequestException('El trabajador no está eliminado');
      }

      // Verificar si ya existe otro trabajador activo con el mismo nombre
      const trabajadorExistente = await this.trabajadorRepository.findOne({
        where: { nombre: trabajador.nombre }
      });

      if (trabajadorExistente) {
        throw new ConflictException(`Ya existe un trabajador activo con el nombre "${trabajador.nombre}"`);
      }

      await this.trabajadorRepository.restore(id);
      const trabajadorRestaurado = await this.obtenerPorId(id);

      this.logger.log(`Trabajador restaurado: ${trabajadorRestaurado.id} - ${trabajadorRestaurado.nombre}`);
      return trabajadorRestaurado;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error restaurando trabajador: ${error.message}`, error.stack);
      throw new BadRequestException('Error al restaurar el trabajador');
    }
  }

  async cambiarEstadoActivo(id: string, activo: boolean): Promise<Trabajador> {
    try {
      const trabajador = await this.obtenerPorId(id);
      trabajador.activo = activo;
      
      const trabajadorActualizado = await this.trabajadorRepository.save(trabajador);

      this.logger.log(`Estado del trabajador ${activo ? 'activado' : 'desactivado'}: ${trabajadorActualizado.id} - ${trabajadorActualizado.nombre}`);
      return trabajadorActualizado;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error cambiando estado del trabajador: ${error.message}`, error.stack);
      throw new BadRequestException('Error al cambiar el estado del trabajador');
    }
  }

  async obtenerTrabajadoresActivos(): Promise<Trabajador[]> {
    try {
      return await this.trabajadorRepository.find({
        where: { activo: true },
        order: { nombre: 'ASC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo trabajadores activos: ${error.message}`, error.stack);
      throw new BadRequestException('Error al obtener los trabajadores activos');
    }
  }

  async obtenerEstadisticas(): Promise<any> {
    try {
      const [total, activos, inactivos, supervisores, trabajadores] = await Promise.all([
        this.trabajadorRepository.count(),
        this.trabajadorRepository.count({ where: { activo: true } }),
        this.trabajadorRepository.count({ where: { activo: false } }),
        this.trabajadorRepository.count({ where: { rol: RolTrabajador.ENCARGADO } }),
        this.trabajadorRepository.count({ where: { rol: RolTrabajador.TRABAJADOR } }),
        this.trabajadorRepository.count({ where: { rol: RolTrabajador.VENDEDOR } }),
      ]);

      const promedioComision = await this.trabajadorRepository
        .createQueryBuilder('trabajador')
        .select('AVG(trabajador.comisionPorcentaje)', 'promedio')
        .where('trabajador.activo = :activo', { activo: true })
        .getRawOne();

      return {
        total,
        activos,
        inactivos,
        porRol: {
          supervisores,
          trabajadores,
        },
        promedioComision: parseFloat(promedioComision?.promedio || '0'),
      };
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error.message}`, error.stack);
      throw new BadRequestException('Error al obtener las estadísticas');
    }
  }
}
