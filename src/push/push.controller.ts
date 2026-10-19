import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { PushService } from './push.service';
import { DesuscribirPushDto, SuscribirPushDto } from './dto/push.dto';

const TODOS = Object.values(RolPersonal);

@ApiTags('Notificaciones push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Roles(...TODOS)
  @Get('clave-publica')
  @ApiOperation({ summary: 'Clave VAPID pública (null si push está apagado)' })
  clavePublica() {
    return { clavePublica: this.push.getClavePublica() };
  }

  @Roles(...TODOS)
  @Post('suscripciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Registrar este navegador para recibir push' })
  async suscribir(@Body() dto: SuscribirPushDto, @Req() req: Request) {
    await this.push.suscribir(this.uid(req), dto, req.headers['user-agent']);
  }

  @Roles(...TODOS)
  @Delete('suscripciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dejar de recibir push en este navegador' })
  async desuscribir(@Body() dto: DesuscribirPushDto, @Req() req: Request) {
    await this.push.desuscribir(this.uid(req), dto.endpoint);
  }

  private uid(req: Request): string {
    return (req.user as { id: string }).id;
  }
}
