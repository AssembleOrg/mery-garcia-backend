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
import { ProductoServicioService } from '../services/producto-servicio.service';
import { 
  CrearProductoServicioDto, 
  ActualizarProductoServicioDto, 
  FiltrarProductosServiciosDto 
} from '../dto/producto-servicio.dto';
import { ProductoServicio } from '../entities/productoServicio.entity';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@ApiTags('Productos y Servicios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('productos-servicios')
export class ProductoServicioController {
  constructor(
    private readonly productoServicioService: ProductoServicioService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Audit({ 
    action: 'CREATE', 
    entityType: 'ProductoServicio',
    description: 'Producto/Servicio creado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ 
    summary: 'Crear un nuevo producto o servicio',
    description: 'Crea un nuevo producto o servicio en el sistema'
  })
  @ApiResponse({
    status: 201,
    description: 'Producto/Servicio creado exitosamente',
    type: ProductoServicio,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Ya existe un producto/servicio con ese nombre o código de barras' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async crear(@Body() crearDto: CrearProductoServicioDto): Promise<ProductoServicio> {
    const productoServicio = await this.productoServicioService.crear(crearDto);
    
    return productoServicio;
  }

  @Get('paginado')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener todos los productos y servicios',
    description: 'Obtiene una lista paginada de productos y servicios con filtros opcionales'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página', example: 20 })
  @ApiQuery({ name: 'nombre', required: false, type: String, description: 'Filtrar por nombre', example: 'Tatuaje' })
  @ApiQuery({ name: 'tipo', required: false, enum: ['PRODUCTO', 'SERVICIO'], description: 'Filtrar por tipo' })
  @ApiQuery({ name: 'unidadNegocioId', required: false, type: String, description: 'Filtrar por unidad de negocio ID' })
  @ApiQuery({ name: 'activo', required: false, type: Boolean, description: 'Filtrar por estado activo' })
  @ApiQuery({ name: 'esPrecioCongelado', required: false, type: Boolean, description: 'Filtrar por precio congelado' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Campo de ordenamiento', example: 'nombre' })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'], description: 'Orden de clasificación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Productos/Servicios obtenidos exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ProductoServicio' } },
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
  async obtenerTodos(@Query() filtros: FiltrarProductosServiciosDto) {
    return this.productoServicioService.obtenerTodos(filtros);
  }

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener todos los productos y servicios',
    description: 'Obtiene una lista de productos y servicios'
  })
  @ApiResponse({ status: 200, description: 'Productos/Servicios obtenidos exitosamente', type: [ProductoServicio] })
  async obtenerTodas(): Promise<ProductoServicio[]> {
    return this.productoServicioService.obtenerTodas();
  }

  @Get('activos')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener productos y servicios activos',
    description: 'Obtiene solo los productos y servicios que están en estado activo'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Productos/Servicios activos obtenidos exitosamente',
    type: [ProductoServicio]
  })
  async obtenerActivos(): Promise<ProductoServicio[]> {
    return this.productoServicioService.obtenerActivos();
  }

  @Get('unidad-negocio/:unidadNegocioId')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener productos y servicios por unidad de negocio',
    description: 'Obtiene los productos y servicios activos de una unidad de negocio específica'
  })
  @ApiParam({ 
    name: 'unidadNegocioId', 
    description: 'ID de la unidad de negocio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Productos/Servicios obtenidos exitosamente',
    type: [ProductoServicio]
  })
  @ApiResponse({ status: 404, description: 'Unidad de negocio no encontrada' })
  async obtenerPorUnidadNegocio(@Param('unidadNegocioId', ParseUUIDPipe) unidadNegocioId: string): Promise<ProductoServicio[]> {
    return this.productoServicioService.obtenerPorUnidadNegocio(unidadNegocioId);
  }

  @Get('estadisticas')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Obtener estadísticas de productos y servicios',
    description: 'Obtiene estadísticas generales sobre productos y servicios'
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
        productos: { type: 'number' },
        servicios: { type: 'number' },
      },
    }
  })
  async obtenerEstadisticas() {
    return this.productoServicioService.obtenerEstadisticas();
  }

  @Get(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener un producto o servicio por ID',
    description: 'Obtiene un producto o servicio específico por su ID'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del producto/servicio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Producto/Servicio obtenido exitosamente',
    type: ProductoServicio,
  })
  @ApiResponse({ status: 404, description: 'Producto/Servicio no encontrado' })
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<ProductoServicio> {
    return this.productoServicioService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Audit({ 
    action: 'UPDATE', 
    entityType: 'ProductoServicio',
    description: 'Producto/Servicio actualizado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ 
    summary: 'Actualizar un producto o servicio',
    description: 'Actualiza un producto o servicio existente'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del producto/servicio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Producto/Servicio actualizado exitosamente',
    type: ProductoServicio,
  })
  @ApiResponse({ status: 404, description: 'Producto/Servicio no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un producto/servicio con ese nombre o código de barras' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() actualizarDto: ActualizarProductoServicioDto,
  ): Promise<ProductoServicio> {
    const productoServicio = await this.productoServicioService.actualizar(id, actualizarDto);
    
    return productoServicio;
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ 
    action: 'DELETE', 
    entityType: 'ProductoServicio',
    description: 'Producto/Servicio eliminado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ 
    summary: 'Eliminar un producto o servicio',
    description: 'Elimina un producto o servicio (soft delete)'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del producto/servicio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ status: 204, description: 'Producto/Servicio eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Producto/Servicio no encontrado' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.productoServicioService.eliminar(id);
    
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
      @Audit({ 
        action: 'UPDATE', 
        entityType: 'ProductoServicio',
        description: 'Producto/Servicio restaurado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
  @ApiOperation({ 
    summary: 'Restaurar un producto o servicio',
    description: 'Restaura un producto o servicio eliminado'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del producto/servicio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Producto/Servicio restaurado exitosamente',
    type: ProductoServicio,
  })
  @ApiResponse({ status: 404, description: 'Producto/Servicio no encontrado' })
  async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<ProductoServicio> {
    const productoServicio = await this.productoServicioService.restaurar(id);
    
    return productoServicio;
  }

  @Patch(':id/estado')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
      @Audit({ 
        action: 'UPDATE', 
        entityType: 'ProductoServicio',
        description: 'Estado activo del producto/servicio cambiado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
  @ApiOperation({ 
    summary: 'Cambiar estado activo de un producto o servicio',
    description: 'Cambia el estado activo de un producto o servicio'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del producto/servicio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiQuery({ 
    name: 'activo', 
    required: true, 
    type: Boolean, 
    description: 'Estado activo (true/false)',
    example: true
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del producto/servicio cambiado exitosamente',
    type: ProductoServicio,
  })
  @ApiResponse({ status: 404, description: 'Producto/Servicio no encontrado' })
  async cambiarEstadoActivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('activo', ParseBoolPipe) activo: boolean,
  ): Promise<ProductoServicio> {
    const productoServicio = await this.productoServicioService.cambiarEstadoActivo(id, activo);
    
    
    return productoServicio;
  }
}
