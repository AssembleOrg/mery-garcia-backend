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
import { ItemComandaService } from '../services/item-comanda.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { 
  CrearItemComandaDto, 
  ActualizarItemComandaDto, 
  FiltrarItemsComandaDto 
} from '../dto/item-comanda.dto';
import { ItemComanda } from '../entities/ItemComanda.entity';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@ApiTags('Items de Comanda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('items-comanda')
export class ItemComandaController {
  constructor(
    private readonly itemComandaService: ItemComandaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Audit({ 
    action: 'CREATE', 
    entityType: 'ItemComanda',
    description: 'Item de comanda creado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ 
    summary: 'Crear un nuevo item de comanda',
    description: 'Crea un nuevo item de comanda en el sistema'
  })
  @ApiResponse({
    status: 201,
    description: 'Item de comanda creado exitosamente',
    type: ItemComanda,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Comanda, producto/servicio, tipo o trabajador no encontrado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async crear(@Body() crearDto: CrearItemComandaDto): Promise<ItemComanda> {
    const itemComanda = await this.itemComandaService.crear(crearDto);

    
    return itemComanda;
  }

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener todos los items de comanda',
    description: 'Obtiene una lista paginada de items de comanda con filtros opcionales'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página', example: 20 })
  @ApiQuery({ name: 'nombre', required: false, type: String, description: 'Filtrar por nombre', example: 'Tatuaje' })
  @ApiQuery({ name: 'comandaId', required: false, type: String, description: 'Filtrar por ID de comanda' })
  @ApiQuery({ name: 'productoServicioId', required: false, type: String, description: 'Filtrar por ID de producto/servicio' })
  @ApiQuery({ name: 'trabajadorId', required: false, type: String, description: 'Filtrar por ID de trabajador' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Campo de ordenamiento', example: 'nombre' })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'], description: 'Orden de clasificación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Items de comanda obtenidos exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ItemComanda' } },
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
  async obtenerTodos(@Query() filtros: FiltrarItemsComandaDto) {
    return this.itemComandaService.obtenerTodos(filtros);
  }

  @Get('comanda/:comandaId')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener items por comanda',
    description: 'Obtiene todos los items de una comanda específica'
  })
  @ApiParam({ 
    name: 'comandaId', 
    description: 'ID de la comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Items de comanda obtenidos exitosamente',
    type: [ItemComanda]
  })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  async obtenerPorComanda(@Param('comandaId', ParseUUIDPipe) comandaId: string): Promise<ItemComanda[]> {
    return this.itemComandaService.obtenerPorComanda(comandaId);
  }

  @Get(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ 
    summary: 'Obtener un item de comanda por ID',
    description: 'Obtiene un item de comanda específico por su ID'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del item de comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Item de comanda obtenido exitosamente',
    type: ItemComanda,
  })
  @ApiResponse({ status: 404, description: 'Item de comanda no encontrado' })
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<ItemComanda> {
    return this.itemComandaService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Audit({ 
    action: 'UPDATE', 
    entityType: 'ItemComanda',
    description: 'Item de comanda actualizado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ 
    summary: 'Actualizar un item de comanda',
    description: 'Actualiza un item de comanda existente'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del item de comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Item de comanda actualizado exitosamente',
    type: ItemComanda,
  })
  @ApiResponse({ status: 404, description: 'Item de comanda no encontrado' })
  @ApiResponse({ status: 404, description: 'Comanda, producto/servicio, tipo o trabajador no encontrado' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() actualizarDto: ActualizarItemComandaDto,
  ): Promise<ItemComanda> {
    const itemComanda = await this.itemComandaService.actualizar(id, actualizarDto);
    
    return itemComanda;
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ 
    action: 'DELETE', 
    entityType: 'ItemComanda',
    description: 'Item de comanda eliminado en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ 
    summary: 'Eliminar un item de comanda',
    description: 'Elimina un item de comanda (soft delete)'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del item de comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({ status: 204, description: 'Item de comanda eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Item de comanda no encontrado' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.itemComandaService.eliminar(id);
    
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
      @Audit({ 
        action: 'UPDATE', 
        entityType: 'ItemComanda',
        description: 'Item de comanda restaurado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
  @ApiOperation({ 
    summary: 'Restaurar un item de comanda',
    description: 'Restaura un item de comanda eliminado'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del item de comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Item de comanda restaurado exitosamente',
    type: ItemComanda,
  })
  @ApiResponse({ status: 404, description: 'Item de comanda no encontrado' })
  async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<ItemComanda> {
    const itemComanda = await this.itemComandaService.restaurar(id);
    


    return itemComanda;
  }
} 