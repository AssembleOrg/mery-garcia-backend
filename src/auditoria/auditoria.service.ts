import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Auditoria } from './entities/Auditoria.entity';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Personal } from 'src/personal/entities/Personal.entity';
import { FiltrarAuditoriaDto } from './dto/filtrar-auditoria.dto';

export interface AuditoriaData {
  tipoAccion: TipoAccion;
  modulo: ModuloSistema;
  descripcion: string;
  datosAnteriores?: any;
  datosNuevos?: any;
  observaciones?: string;
  ipAddress?: string;
  userAgent?: string;
  usuario?: Personal;
  entidadId?: string;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private auditoriaRepository: Repository<Auditoria>,
  ) {}

  async registrar(data: AuditoriaData, entityManager?: EntityManager): Promise<Auditoria> {
    try {
      // Validar datos requeridos
      if (!data.tipoAccion) {
        console.error('[AuditoriaService] Error: tipoAccion es requerido', data);
        throw new Error('tipoAccion es requerido para registrar auditoría');
      }

      if (!data.modulo) {
        console.error('[AuditoriaService] Error: modulo es requerido', data);
        throw new Error('modulo es requerido para registrar auditoría');
      }

      if (!data.descripcion) {
        console.error('[AuditoriaService] Error: descripcion es requerida', data);
        throw new Error('descripcion es requerida para registrar auditoría');
      }

      // Valores por defecto para campos opcionales
      // Usar undefined en lugar de null para campos opcionales
      const auditoriaData: any = {
        tipoAccion: data.tipoAccion,
        modulo: data.modulo,
        descripcion: data.descripcion,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || 'unknown',
        createdAt: new Date(),
      };

      // Solo agregar campos opcionales si tienen valor
      if (data.datosAnteriores) {
        auditoriaData.datosAnteriores = data.datosAnteriores;
      }
      if (data.datosNuevos) {
        auditoriaData.datosNuevos = data.datosNuevos;
      }
      if (data.observaciones) {
        auditoriaData.observaciones = data.observaciones;
      }
      if (data.usuario) {
        auditoriaData.usuario = data.usuario;
      }
      if (data.entidadId) {
        auditoriaData.entidadId = data.entidadId;
      }

      // Log para debugging
      console.log('[AuditoriaService] Registrando auditoría:', {
        tipoAccion: auditoriaData.tipoAccion,
        modulo: auditoriaData.modulo,
        descripcion: auditoriaData.descripcion?.substring(0, 50),
        entidadId: auditoriaData.entidadId,
        hasUsuario: !!auditoriaData.usuario,
        ipAddress: auditoriaData.ipAddress,
      });

      const auditoria = this.auditoriaRepository.create(auditoriaData);

      // Si se proporciona un EntityManager (transacción), usarlo
      let savedAuditoria: Auditoria;
      if (entityManager) {
        savedAuditoria = (await entityManager.save(Auditoria, auditoria)) as unknown as Auditoria;
      } else {
        // Si no, usar el repositorio normal
        savedAuditoria = (await this.auditoriaRepository.save(auditoria)) as unknown as Auditoria;
      }

      console.log('[AuditoriaService] Auditoría registrada exitosamente:', {
        id: savedAuditoria.id,
        tipoAccion: savedAuditoria.tipoAccion,
        modulo: savedAuditoria.modulo,
      });

      return savedAuditoria;
    } catch (error) {
      console.error('[AuditoriaService] Error al registrar auditoría:', {
        error: error.message,
        stack: error.stack,
        data: {
          tipoAccion: data?.tipoAccion,
          modulo: data?.modulo,
          descripcion: data?.descripcion?.substring(0, 50),
          entidadId: data?.entidadId,
          hasUsuario: !!data?.usuario,
        },
      });
      throw error;
    }
  }

  async obtenerConPaginacion(filtros: FiltrarAuditoriaDto) {
    const {
      page = 1,
      limit = 10,
      offset = 0,
      search,
      modulo,
      tipoAccion,
      usuarioId,
      entidadId,
      fechaInicio,
      fechaFin,
      orderBy = 'createdAt',
      orderDirection = 'DESC',
    } = filtros;
    
    // Usar offset si se proporciona, sino calcular desde page
    const skip = offset > 0 ? offset : (page - 1) * limit;

    const queryBuilder = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.usuario', 'usuario');

    // Filtro de búsqueda en descripción
    if (search) {
      queryBuilder.andWhere(
        '(auditoria.descripcion ILIKE :search OR auditoria.observaciones ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filtro por módulo
    if (modulo) {
      queryBuilder.andWhere('auditoria.modulo = :modulo', { modulo });
    }

    // Filtro por tipo de acción
    if (tipoAccion) {
      queryBuilder.andWhere('auditoria.tipoAccion = :tipoAccion', { tipoAccion });
    }

    // Filtro por usuario
    if (usuarioId) {
      queryBuilder.andWhere('usuario.id = :usuarioId', { usuarioId });
    }

    // Filtro por entidad ID
    if (entidadId) {
      queryBuilder.andWhere('auditoria.entidadId = :entidadId', { entidadId });
    }

    // Filtro por fechas - usando el mismo patrón que comandas
    if (fechaInicio && fechaFin) {
      // Caso "mismo día": de 00:00:00 a 23:59:59.999
      if (fechaInicio === fechaFin) {
        const inicio = new Date(fechaInicio);
        inicio.setUTCHours(0, 0, 0, 0);

        const fin = new Date(fechaFin);
        fin.setUTCHours(23, 59, 59, 999);

        queryBuilder.andWhere('auditoria.createdAt BETWEEN :inicio AND :fin', {
          inicio,
          fin,
        });
      }
      // Rango normal
      else {
        queryBuilder.andWhere(
          'auditoria.createdAt BETWEEN :fechaInicio AND :fechaFin',
          { fechaInicio, fechaFin },
        );
      }
    } else if (fechaInicio) {
      // Sólo "desde"
      queryBuilder.andWhere('auditoria.createdAt >= :fechaInicio', {
        fechaInicio,
      });
    } else if (fechaFin) {
      // Sólo "hasta"
      queryBuilder.andWhere('auditoria.createdAt <= :fechaFin', {
        fechaFin,
      });
    }

    // Validar campo de ordenamiento
    const camposPermitidos = ['createdAt', 'tipoAccion', 'modulo', 'descripcion', 'entidadId'];
    const campoOrdenamiento = camposPermitidos.includes(orderBy) ? orderBy : 'createdAt';

    queryBuilder.orderBy(
      `auditoria.${campoOrdenamiento}`,
      orderDirection as 'ASC' | 'DESC',
    );

    const [auditorias, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // console.log('Resultados:', { auditorias: auditorias.length, total });

    return {
      data: auditorias,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async obtenerTodas(): Promise<Auditoria[]> {
    return await this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.usuario', 'usuario')
      .orderBy('auditoria.createdAt', 'DESC')
      .getMany();
  }

  async obtenerAuditoria(
    modulo?: ModuloSistema,
    tipoAccion?: TipoAccion,
    usuarioId?: string,
    fechaInicio?: Date,
    fechaFin?: Date,
    limit = 50,
    offset = 0,
  ): Promise<{ auditorias: Auditoria[]; total: number }> {
    const queryBuilder = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.usuario', 'usuario')
      .orderBy('auditoria.createdAt', 'DESC');

    if (modulo) {
      queryBuilder.andWhere('auditoria.modulo = :modulo', { modulo });
    }

    if (tipoAccion) {
      queryBuilder.andWhere('auditoria.tipoAccion = :tipoAccion', { tipoAccion });
    }

    if (usuarioId) {
      queryBuilder.andWhere('usuario.id = :usuarioId', { usuarioId });
    }

    if (fechaInicio) {
      queryBuilder.andWhere('auditoria.createdAt >= :fechaInicio', { fechaInicio });
    }

    if (fechaFin) {
      queryBuilder.andWhere('auditoria.createdAt <= :fechaFin', { fechaFin });
    }

    const [auditorias, total] = await queryBuilder
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { auditorias, total };
  }

  async obtenerAuditoriaPorUsuario(usuarioId: string, limit = 50): Promise<Auditoria[]> {
    return await this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.usuario', 'usuario')
      .where('usuario.id = :usuarioId', { usuarioId })
      .orderBy('auditoria.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async obtenerAuditoriaPorModulo(modulo: ModuloSistema, limit = 50): Promise<Auditoria[]> {
    return await this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.usuario', 'usuario')
      .where('auditoria.modulo = :modulo', { modulo })
      .orderBy('auditoria.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
} 