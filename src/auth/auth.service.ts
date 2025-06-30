import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Personal } from 'src/personal/entities/Personal.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RolPersonal } from 'src/enums/RolPersonal.enum';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Personal)
    private personalRepository: Repository<Personal>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.personalRepository.findOne({
      where: { email, activo: true },
    });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { 
      email: user.email, 
      sub: user.id,
      rol: user.rol,
      nombre: user.nombre,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        unidadesDisponibles: user.unidadesDisponibles,
        comisionPorcentaje: user.comisionPorcentaje,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Verificar si el email ya existe
    const existingUser = await this.personalRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    if (registerDto.rol === RolPersonal.ADMIN) {
      registerDto.rol = RolPersonal.USER;
    }

    // Crear el nuevo usuario
    // Ajustable solo en local para crear el admin
    const newUser = this.personalRepository.create({
      ...registerDto,
      password: hashedPassword,
      rol: registerDto.rol,
      unidadesDisponibles: registerDto.unidadesDisponibles || [UnidadNegocio.TATTOO],
      activo: registerDto.activo !== undefined ? registerDto.activo : true,
      comisionPorcentaje: registerDto.comisionPorcentaje || 0,
    });

    const savedUser = await this.personalRepository.save(newUser);

    // Retornar el usuario sin la contraseña
    const { password, ...result } = savedUser;
    return result;
  }

  async getProfile(userId: string) {
    const user = await this.personalRepository.findOne({
      where: { id: userId, activo: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const { password, ...result } = user;
    return result;
  }
}
