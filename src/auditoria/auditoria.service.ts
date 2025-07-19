import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Auditoria } from './entities/Auditoria.entity';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Personal } from 'src/personal/entities/Personal.entity';

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
    const auditoria = this.auditoriaRepository.create({
      ...data,
      createdAt: new Date(),
    });

    // Si se proporciona un EntityManager (transacción), usarlo
    if (entityManager) {
      return await entityManager.save(Auditoria, auditoria);
    }

    // Si no, usar el repositorio normal
    return await this.auditoriaRepository.save(auditoria);
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