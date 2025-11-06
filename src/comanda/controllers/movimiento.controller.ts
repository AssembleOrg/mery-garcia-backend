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
import { MovimientoService } from '../services/movimiento.service';
import { 
  CrearMovimientoDto, 
  ActualizarMovimientoDto, 
  FiltrarMovimientosDto 
} from '../dto/movimiento.dto';
import { Movimiento } from '../entities/movimiento.entity';

@ApiTags('Movimientos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('movimientos')
export class MovimientoController {
  constructor(private readonly movimientoService: MovimientoService) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Crear un nuevo movimiento',
    description: 'Crea un nuevo movimiento en el sistema'
  })
  @ApiResponse({
    status: 201,
    description: 'Movimiento creado exitosamente',
    type: Movimiento,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Comanda o personal no encontrado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async crear(@Body() crearDto: CrearMovimientoDto): Promise<Movimiento> {
    return this.movimientoService.crear(crearDto);
  }

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener todos los movimientos',
    description: 'Obtiene una lista paginada de movimientos con filtros opcionales'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página', example: 20 })
  @ApiQuery({ name: 'comandaId', required: false, type: String, description: 'Filtrar por ID de comanda' })
  @ApiQuery({ name: 'personalId', required: false, type: String, description: 'Filtrar por ID de personal' })
  @ApiQuery({ name: 'montoMinimo', required: false, type: Number, description: 'Filtrar por monto mínimo' })
  @ApiQuery({ name: 'montoMaximo', required: false, type: Number, description: 'Filtrar por monto máximo' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Campo de ordenamiento', example: 'createdAt' })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'], description: 'Orden de clasificación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Movimientos obtenidos exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/Movimiento' } },
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
  async obtenerTodos(@Query() filtros: FiltrarMovimientosDto) {
    return this.movimientoService.obtenerTodos(filtros);
  }

  @Get('comanda/:comandaId')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener movimientos por comanda',
    description: 'Obtiene todos los movimientos de una comanda específica'
  })
  @ApiParam({ 
    name: 'comandaId', 
    description: 'ID de la comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Movimientos obtenidos exitosamente',
    type: [Movimiento]
  })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  async obtenerPorComanda(@Param('comandaId', ParseUUIDPipe) comandaId: string): Promise<Movimiento[]> {
    return this.movimientoService.obtenerPorComanda(comandaId);
  }

  @Get('personal/:personalId')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener movimientos por personal',
    description: 'Obtiene todos los movimientos de un personal específico'
  })
  @ApiParam({ 
    name: 'personalId', 
    description: 'ID del personal',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Movimientos obtenidos exitosamente',
    type: [Movimiento]
  })
  @ApiResponse({ status: 404, description: 'Personal no encontrado' })
  async obtenerPorPersonal(@Param('personalId', ParseUUIDPipe) personalId: string): Promise<Movimiento[]> {
    return this.movimientoService.obtenerPorPersonal(personalId);
  }

  @Get(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener un movimiento por ID',
    description: 'Obtiene un movimiento específico por su ID'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del movimiento',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Movimiento obtenido exitosamente',
    type: Movimiento,
  })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<Movimiento> {
    return this.movimientoService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Actualizar un movimiento',
    description: 'Actualiza un movimiento existente'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del movimiento',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Movimiento actualizado exitosamente',
    type: Movimiento,
  })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  @ApiResponse({ status: 404, description: 'Comanda o personal no encontrado' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() actualizarDto: ActualizarMovimientoDto,
  ): Promise<Movimiento> {
    return this.movimientoService.actualizar(id, actualizarDto);
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Eliminar un movimiento',
    description: 'Elimina un movimiento y revierte todos los cambios asociados: devuelve las comandas a estado VALIDADO y revierte los cambios en montoTraspasado de los prepagos relacionados'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del movimiento',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ status: 204, description: 'Movimiento eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.movimientoService.eliminar(id);
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Restaurar un movimiento',
    description: 'Restaura un movimiento eliminado'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del movimiento',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Movimiento restaurado exitosamente',
    type: Movimiento,
  })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<Movimiento> {
    return this.movimientoService.restaurar(id);
  }
} 