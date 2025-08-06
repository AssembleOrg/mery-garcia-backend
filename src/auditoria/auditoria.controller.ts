import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { AuditoriaService } from './auditoria.service';
import { FiltrarAuditoriaDto } from './dto/filtrar-auditoria.dto';
import { Auditoria } from './entities/Auditoria.entity';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { TipoAccion } from 'src/enums/TipoAccion.enum';

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get('test')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Endpoint de prueba para verificar datos de auditoría',
    description: 'Retorna información básica sobre los datos de auditoría',
  })
  @ApiResponse({
    status: 200,
    description: 'Información de prueba obtenida exitosamente',
  })
  async testAuditoria() {
    const total = await this.auditoriaService.obtenerTodas();
    return {
      message: 'Test de auditoría',
      totalRegistros: total.length,
      primerRegistro: total[0] || null,
      ultimoRegistro: total[total.length - 1] || null,
    };
  }

  @Get('paginada')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Obtener auditorías con paginación y filtros',
    description: 'Retorna una lista paginada de auditorías con filtros opcionales',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página', example: 10 })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Número de elementos a saltar', example: 0 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda en descripción y observaciones', example: 'Producto actualizado' })
  @ApiQuery({ name: 'modulo', required: false, enum: ModuloSistema, description: 'Filtrar por módulo del sistema' })
  @ApiQuery({ name: 'tipoAccion', required: false, enum: TipoAccion, description: 'Filtrar por tipo de acción' })
  @ApiQuery({ name: 'usuarioId', required: false, type: String, description: 'Filtrar por ID de usuario' })
  @ApiQuery({ name: 'entidadId', required: false, type: String, description: 'Filtrar por ID de entidad' })
  @ApiQuery({ name: 'fechaInicio', required: false, type: String, description: 'Fecha de inicio (YYYY-MM-DD)', example: '2025-08-05' })
  @ApiQuery({ name: 'fechaFin', required: false, type: String, description: 'Fecha de fin (YYYY-MM-DD)', example: '2025-08-05' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Campo de ordenamiento', example: 'createdAt' })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'], description: 'Orden de clasificación' })
  @ApiResponse({
    status: 200,
    description: 'Auditorías obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { 
          type: 'array', 
          items: { $ref: '#/components/schemas/Auditoria' } 
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerConPaginacion(@Query() filtros: FiltrarAuditoriaDto) {
    return await this.auditoriaService.obtenerConPaginacion(filtros);
  }

  @Get('todas')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Obtener todas las auditorías del sistema',
    description: 'Retorna todas las auditorías sin paginación, ordenadas por fecha de creación descendente',
  })
  @ApiResponse({
    status: 200,
    description: 'Todas las auditorías obtenidas exitosamente',
    type: [Auditoria],
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerTodas(): Promise<Auditoria[]> {
    return await this.auditoriaService.obtenerTodas();
  }

  @Get('por-usuario/:usuarioId')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Obtener auditorías por usuario',
    description: 'Retorna las auditorías realizadas por un usuario específico',
  })
  @ApiParam({ name: 'usuarioId', description: 'ID del usuario', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Auditorías del usuario obtenidas exitosamente',
    type: [Auditoria],
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async obtenerPorUsuario(@Param('usuarioId', ParseUUIDPipe) usuarioId: string): Promise<Auditoria[]> {
    return await this.auditoriaService.obtenerAuditoriaPorUsuario(usuarioId);
  }

  @Get('por-modulo/:modulo')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Obtener auditorías por módulo',
    description: 'Retorna las auditorías de un módulo específico del sistema',
  })
  @ApiParam({ name: 'modulo', enum: ModuloSistema, description: 'Módulo del sistema' })
  @ApiResponse({
    status: 200,
    description: 'Auditorías del módulo obtenidas exitosamente',
    type: [Auditoria],
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerPorModulo(@Param('modulo') modulo: ModuloSistema): Promise<Auditoria[]> {
    return await this.auditoriaService.obtenerAuditoriaPorModulo(modulo);
  }
} 