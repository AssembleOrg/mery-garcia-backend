import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RolPersonal } from 'src/enums/RolPersonal.enum';

/**
 * Sesión válida. Además, el rol "empleado" queda encerrado: sólo entra a los
 * endpoints que lo nombran en @Roles. Muchos endpoints no declaran roles y
 * dejan pasar a cualquier sesión; sin esto, un empleado podría leer cajas o
 * clientes llamando a la API a mano.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(ctx)) as boolean;
    if (!ok) return false;

    const req = ctx
      .switchToHttp()
      .getRequest<{ user?: { rol?: RolPersonal } }>();
    const user = req.user;
    if (user?.rol !== RolPersonal.EMPLEADO) return true;

    const roles =
      this.reflector.get<RolPersonal[]>('roles', ctx.getHandler()) ?? [];
    if (!roles.includes(RolPersonal.EMPLEADO)) {
      throw new ForbiddenException('Sin acceso a esta sección');
    }
    return true;
  }
}
