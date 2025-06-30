/* // roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/user/user.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
 */

import { SetMetadata } from '@nestjs/common';
import { RolPersonal } from 'src/enums/RolPersonal.enum';

export const Roles = (...roles: RolPersonal[]) => SetMetadata('roles', roles);