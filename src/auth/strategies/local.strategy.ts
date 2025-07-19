import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personal } from 'src/personal/entities/Personal.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(Personal)
    private personalRepository: Repository<Personal>,
  ) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.personalRepository.findOne({
      where: { email, activo: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
    };
  }
}