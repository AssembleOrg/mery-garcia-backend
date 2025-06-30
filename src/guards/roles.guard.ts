// roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolPersonal } from 'src/enums/RolPersonal.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<RolPersonal[]>(
      'roles',
      ctx.getHandler(),
    );
    if (!requiredRoles) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    if (!requiredRoles.includes(user.rol as RolPersonal)) {
      throw new ForbiddenException(
        `Requires one of: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
