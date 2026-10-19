import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Personal } from '../personal/entities/Personal.entity';
import { Trabajador } from '../personal/entities/Trabajador.entity';
import { RolPersonal } from '../enums/RolPersonal.enum';

export interface AccesoEmpleadoDto {
  trabajadorId: string;
  usuario: string;
  activo: boolean;
}

/**
 * Usuario y contraseña para que un trabajador entre al sistema con rol
 * "empleado" (sólo pide productos). Es una fila de `personal` atada al
 * trabajador; quitar el acceso la desactiva, no la borra.
 */
@Injectable()
export class AccesosEmpleadoService {
  constructor(
    @InjectRepository(Personal)
    private readonly personalRepo: Repository<Personal>,
    @InjectRepository(Trabajador)
    private readonly trabajadorRepo: Repository<Trabajador>,
  ) {}

  async listar(): Promise<AccesoEmpleadoDto[]> {
    const filas = await this.personalRepo
      .createQueryBuilder('p')
      .where('p.trabajadorId IS NOT NULL')
      .andWhere('p.rol = :rol', { rol: RolPersonal.EMPLEADO })
      .getMany();
    return filas.map((p) => this.aDto(p));
  }

  /** Crea el acceso o le cambia usuario / contraseña. También lo reactiva. */
  async guardar(
    trabajadorId: string,
    usuarioIn: string,
    password?: string,
  ): Promise<AccesoEmpleadoDto> {
    const trabajador = await this.trabajadorRepo.findOne({
      where: { id: trabajadorId },
    });
    if (!trabajador)
      throw new NotFoundException(
        `Trabajador con ID ${trabajadorId} no encontrado`,
      );
    if (!trabajador.activo)
      throw new BadRequestException('El trabajador está inactivo');

    const usuario = usuarioIn.trim().toLowerCase();
    const existente = await this.personalRepo.findOne({
      where: { trabajadorId },
      withDeleted: true,
    });

    const ocupado = await this.personalRepo
      .createQueryBuilder('p')
      .withDeleted()
      .where('LOWER(p.email) = :usuario', { usuario })
      .getOne();
    if (ocupado && ocupado.id !== existente?.id) {
      throw new ConflictException('Ese usuario ya está en uso');
    }

    if (existente) {
      if (existente.rol !== RolPersonal.EMPLEADO) {
        throw new ConflictException(
          'Este trabajador ya tiene un acceso con otro rol',
        );
      }
      if (existente.deletedAt) await this.personalRepo.restore(existente.id);
      existente.email = usuario;
      existente.nombre = trabajador.nombre;
      existente.activo = true;
      existente.deletedAt = undefined;
      if (password) existente.password = await bcrypt.hash(password, 10);
      return this.aDto(await this.personalRepo.save(existente));
    }

    if (!password) throw new BadRequestException('Falta la contraseña');
    const nuevo = this.personalRepo.create({
      nombre: trabajador.nombre,
      email: usuario,
      password: await bcrypt.hash(password, 10),
      rol: RolPersonal.EMPLEADO,
      activo: true,
      trabajadorId,
      fechaIngreso: new Date(),
    });
    return this.aDto(await this.personalRepo.save(nuevo));
  }

  /** Corta el acceso: no puede entrar más (sus solicitudes quedan). */
  async quitar(trabajadorId: string): Promise<void> {
    const r = await this.personalRepo.update(
      { trabajadorId, rol: RolPersonal.EMPLEADO },
      { activo: false },
    );
    if (!r.affected)
      throw new NotFoundException('Ese trabajador no tiene acceso');
  }

  /** El trabajador de la sesión (sólo rol empleado con acceso activo). */
  async trabajadorDe(personalId: string): Promise<string> {
    const p = await this.personalRepo.findOne({
      where: { id: personalId, rol: RolPersonal.EMPLEADO, activo: true },
      select: { id: true, trabajadorId: true },
    });
    if (!p?.trabajadorId)
      throw new NotFoundException(
        'Tu usuario no está vinculado a ningún trabajador',
      );
    return p.trabajadorId;
  }

  private aDto(p: Personal): AccesoEmpleadoDto {
    return {
      trabajadorId: p.trabajadorId as string,
      usuario: p.email,
      activo: p.activo,
    };
  }
}
