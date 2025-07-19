import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
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
import { UnidadNegocioService } from '../services/unidad-negocio.service';
import { 
  CrearUnidadNegocioDto, 
  ActualizarUnidadNegocioDto, 
  FiltrarUnidadesNegocioDto 
} from '../dto/unidad-negocio.dto';
import { UnidadNegocio } from '../entities/unidadNegocio.entity';

@ApiTags('Unidades de Negocio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('unidades-negocio')
export class UnidadNegocioController {
  constructor(private readonly unidadNegocioService: UnidadNegocioService) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Crear una nueva unidad de negocio',
    description: 'Crea una nueva unidad de negocio en el sistema'
  })
  @ApiResponse({
    status: 201,
    description: 'Unidad de negocio creada exitosamente',
    type: UnidadNegocio,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Ya existe una unidad de negocio con ese nombre' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async crear(@Body() crearDto: CrearUnidadNegocioDto): Promise<UnidadNegocio> {
    return this.unidadNegocioService.crear(crearDto);
  }

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener todas las unidades de negocio',
    description: 'Obtiene una lista de unidades de negocio'
  })
  @ApiResponse({ status: 200, description: 'Unidades de negocio obtenidas exitosamente', type: [UnidadNegocio] })
  async obtenerTodas(): Promise<UnidadNegocio[]> {
    return this.unidadNegocioService.obtenerTodas();
  }

  @Get('paginado')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener todas las unidades de negocio',
    description: 'Obtiene una lista paginada de unidades de negocio con filtros opcionales'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página', example: 20 })
  @ApiQuery({ name: 'nombre', required: false, type: String, description: 'Filtrar por nombre', example: 'Tattoo' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Campo de ordenamiento', example: 'nombre' })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'], description: 'Orden de clasificación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Unidades de negocio obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/UnidadNegocio' } },
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
    }
  })
  async obtenerTodos(@Query() filtros: FiltrarUnidadesNegocioDto) {
    return this.unidadNegocioService.obtenerTodos(filtros);
  }

  @Get(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener una unidad de negocio por ID',
    description: 'Obtiene una unidad de negocio específica por su ID'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la unidad de negocio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Unidad de negocio obtenida exitosamente',
    type: UnidadNegocio,
  })
  @ApiResponse({ status: 404, description: 'Unidad de negocio no encontrada' })
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<UnidadNegocio> {
    return this.unidadNegocioService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Actualizar una unidad de negocio',
    description: 'Actualiza una unidad de negocio existente'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la unidad de negocio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Unidad de negocio actualizada exitosamente',
    type: UnidadNegocio,
  })
  @ApiResponse({ status: 404, description: 'Unidad de negocio no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe una unidad de negocio con ese nombre' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() actualizarDto: ActualizarUnidadNegocioDto,
  ): Promise<UnidadNegocio> {
    return this.unidadNegocioService.actualizar(id, actualizarDto);
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Eliminar una unidad de negocio',
    description: 'Elimina una unidad de negocio (soft delete)'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la unidad de negocio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ status: 204, description: 'Unidad de negocio eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Unidad de negocio no encontrada' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.unidadNegocioService.eliminar(id);
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Restaurar una unidad de negocio',
    description: 'Restaura una unidad de negocio eliminada'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la unidad de negocio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Unidad de negocio restaurada exitosamente',
    type: UnidadNegocio,
  })
  @ApiResponse({ status: 404, description: 'Unidad de negocio no encontrada' })
  async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<UnidadNegocio> {
    return this.unidadNegocioService.restaurar(id);
  }
} 