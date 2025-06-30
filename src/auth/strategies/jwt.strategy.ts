import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personal } from 'src/personal/entities/Personal.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Personal)
    private personalRepository: Repository<Personal>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.personalRepository.findOne({
      where: { id: payload.sub, activo: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      unidadesDisponibles: user.unidadesDisponibles,
      comisionPorcentaje: user.comisionPorcentaje,
      sub: user.id, // Para compatibilidad con el payload JWT
    };
  }
} 