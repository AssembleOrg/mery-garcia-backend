import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { TrabajadorService } from '../services/trabajador.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { 
  CrearTrabajadorDto, 
  ActualizarTrabajadorDto, 
  FiltrarTrabajadoresDto 
} from '../dto/trabajador.dto';
import { Trabajador } from '../entities/Trabajador.entity';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@ApiTags('Trabajadores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trabajadores')
export class TrabajadorController {
  constructor(
    private readonly trabajadorService: TrabajadorService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Audit({ 
    action: 'CREATE', 
    entityType: 'Trabajador',
    description: 'Trabajador creado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ 
    summary: 'Crear un nuevo trabajador',
    description: 'Crea un nuevo trabajador en el sistema'
  })
  @ApiResponse({
    status: 201,
    description: 'Trabajador creado exitosamente',
    type: Trabajador,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Ya existe un trabajador con ese nombre' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async crear(@Body() crearTrabajadorDto: CrearTrabajadorDto): Promise<Trabajador> {
    const trabajador = await this.trabajadorService.crear(crearTrabajadorDto);
    
    // Registrar auditoría
    return trabajador;
  }

  @Get('paginado')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Obtener todos los trabajadores',
    description: 'Obtiene una lista paginada de trabajadores con filtros opcionales'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Trabajadores obtenidos exitosamente',
    schema: {
      type: 'object',
      properties: {
        trabajadores: { type: 'array', items: { $ref: '#/components/schemas/Trabajador' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerTodos(@Query() filtros: FiltrarTrabajadoresDto) {
    return this.trabajadorService.obtenerTodos(filtros);
  }

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener todos los trabajadores',
    description: 'Obtiene una lista de trabajadores'
  })
  @ApiResponse({ status: 200, description: 'Trabajadores obtenidos exitosamente', type: [Trabajador] })
  async obtenerTodas(): Promise<Trabajador[]> {
    return this.trabajadorService.obtenerTodas();
  }

  @Get('list')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Obtener todos los trabajadores sin paginación',
    description: 'Obtiene una lista completa de trabajadores sin paginación'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Trabajadores obtenidos exitosamente',
    type: [Trabajador]
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerTodosSinPaginacion(): Promise<Trabajador[]> {
    return this.trabajadorService.obtenerTodosSinPaginacion();
  }

  @Get('activos')
  @ApiOperation({ 
    summary: 'Obtener trabajadores activos',
    description: 'Obtiene solo los trabajadores que están en estado activo'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Trabajadores activos obtenidos exitosamente',
    type: [Trabajador]
  })
  async obtenerTrabajadoresActivos(): Promise<Trabajador[]> {
    return this.trabajadorService.obtenerTrabajadoresActivos();
  }

  @Get('estadisticas')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Obtener estadísticas de trabajadores',
    description: 'Obtiene estadísticas generales sobre los trabajadores'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estadísticas obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        activos: { type: 'number' },
        inactivos: { type: 'number' },
        porRol: {
          type: 'object',
          properties: {
            supervisores: { type: 'number' },
            trabajadores: { type: 'number' }
          }
        },
        promedioComision: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerEstadisticas() {
    return this.trabajadorService.obtenerEstadisticas();
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'ID del trabajador', example: 'uuid-del-trabajador' })
  @ApiOperation({ 
    summary: 'Obtener trabajador por ID',
    description: 'Obtiene un trabajador específico por su ID'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Trabajador obtenido exitosamente',
    type: Trabajador
  })
  @ApiResponse({ status: 404, description: 'Trabajador no encontrado' })
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<Trabajador> {
    return this.trabajadorService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Audit({ 
    action: 'UPDATE', 
    entityType: 'Trabajador',
    description: 'Trabajador actualizado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiParam({ name: 'id', description: 'ID del trabajador', example: 'uuid-del-trabajador' })
  @ApiOperation({ 
    summary: 'Actualizar trabajador',
    description: 'Actualiza un trabajador existente con los datos proporcionados'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Trabajador actualizado exitosamente',
    type: Trabajador
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Trabajador no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un trabajador con ese nombre' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() actualizarTrabajadorDto: ActualizarTrabajadorDto,
  ): Promise<Trabajador> {
    const trabajadorActualizado = await this.trabajadorService.actualizar(id, actualizarTrabajadorDto);
    
    // Registrar auditoría


    return trabajadorActualizado;
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ 
    action: 'DELETE', 
    entityType: 'Trabajador',
    description: 'Trabajador eliminado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiParam({ name: 'id', description: 'ID del trabajador', example: 'uuid-del-trabajador' })
  @ApiOperation({ 
    summary: 'Eliminar trabajador (soft delete)',
    description: 'Elimina un trabajador de forma lógica (soft delete)'
  })
  @ApiResponse({ status: 204, description: 'Trabajador eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Trabajador no encontrado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.trabajadorService.eliminar(id);
    
    // Registrar auditoría
 
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN)
  @Audit({ 
    action: 'UPDATE', 
    entityType: 'Trabajador',
    description: 'Trabajador restaurado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiParam({ name: 'id', description: 'ID del trabajador', example: 'uuid-del-trabajador' })
  @ApiOperation({ 
    summary: 'Restaurar trabajador eliminado',
    description: 'Restaura un trabajador que fue eliminado (soft delete)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Trabajador restaurado exitosamente',
    type: Trabajador
  })
  @ApiResponse({ status: 404, description: 'Trabajador no encontrado' })
  @ApiResponse({ status: 400, description: 'El trabajador no está eliminado' })
  @ApiResponse({ status: 409, description: 'Ya existe un trabajador activo con ese nombre' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<Trabajador> {
    const trabajadorRestaurado = await this.trabajadorService.restaurar(id);
    
    // Registrar auditoría


    return trabajadorRestaurado;
  }

  @Patch(':id/estado')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Audit({ 
    action: 'UPDATE', 
    entityType: 'Trabajador',
    description: 'Estado del trabajador cambiado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiParam({ name: 'id', description: 'ID del trabajador', example: 'uuid-del-trabajador' })
  @ApiQuery({ name: 'activo', description: 'Estado activo', type: Boolean, example: true })
  @ApiOperation({ 
    summary: 'Cambiar estado activo del trabajador',
    description: 'Activa o desactiva un trabajador'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado del trabajador cambiado exitosamente',
    type: Trabajador
  })
  @ApiResponse({ status: 404, description: 'Trabajador no encontrado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async cambiarEstadoActivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('activo', ParseBoolPipe) activo: boolean,
  ): Promise<Trabajador> {
    const trabajadorActualizado = await this.trabajadorService.cambiarEstadoActivo(id, activo);
    

    return trabajadorActualizado;
  }
}
