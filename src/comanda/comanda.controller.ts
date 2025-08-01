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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolPersonal } from 'src/enums/RolPersonal.enum';
import { ComandaService } from './comanda.service';
import { CrearComandaDto } from './dto/crear-comanda.dto';
import { ActualizarComandaDto } from './dto/actualizar-comanda.dto';
import { FiltrarComandasDto } from './dto/filtrar-comandas.dto';
import { EstadoDeComanda } from './entities/Comanda.entity';
import { Comanda } from './entities/Comanda.entity';
import { CrearEgresoDto } from './dto/crear-egreso.dto';
import { Egreso } from './entities/egreso.entity';

@ApiTags('Comandas')
@Controller('comandas')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ComandaController {
  constructor(private readonly comandaService: ComandaService) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Crear una nueva comanda',
    description: 'Crea una nueva comanda con todos sus datos',
  })
  @ApiResponse({
    status: 201,
    description: 'Comanda creada exitosamente',
    type: Comanda,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cliente, trabajador o personal no encontrado' })
  async crear(@Body() crearComandaDto: CrearComandaDto): Promise<Comanda> {
    // console.log(JSON.stringify(crearComandaDto, null, 2));
    // return new  Comanda();
    return await this.comandaService.crear(crearComandaDto);
  }

  @Post('egreso')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Crear un egreso',
    description: 'Crea un egreso con todos sus datos',
  })
  async crearComandaEgreso(@Body() crearEgresoDto: CrearEgresoDto): Promise<Comanda> {
    return await this.comandaService.crearEgreso(crearEgresoDto);
  }

  @Get('egreso/ultimo')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener el último egreso',
    description: 'Obtiene el último egreso creado',
  })
  async obtenerUltimoEgreso(): Promise<Comanda | null> {
    return await this.comandaService.getLastComandaEgreso();
  }

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener todas las comandas',
    description: 'Obtiene una lista de todas las comandas sin paginación',
  })
  @ApiResponse({
    status: 200,
    description: 'Comandas obtenidas exitosamente',
    type: [Comanda],
  })
  async obtenerTodos(): Promise<Comanda[]> {
    return await this.comandaService.obtenerTodos();
  }

  @Get('paginados')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener comandas con paginación',
    description: 'Obtiene una lista paginada de comandas con filtros opcionales',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página', example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Término de búsqueda', example: 'COM-2024' })
  @ApiQuery({ name: 'tipoDeComanda', required: false, enum: ['INGRESO', 'EGRESO'], description: 'Tipo de comanda' })
  @ApiQuery({ name: 'estadoDeComanda', required: false, enum: ['PENDIENTE', 'PAGADA', 'CANCELADA', 'FINALIZADA', 'TRASPASADA'], description: 'Estado de la comanda' })
  @ApiQuery({ name: 'clienteId', required: false, type: String, description: 'ID del cliente' })
  @ApiQuery({ name: 'trabajadorId', required: false, type: String, description: 'ID del trabajador' })
  @ApiQuery({ name: 'creadoPorId', required: false, type: String, description: 'ID del personal que creó la comanda' })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String, description: 'Fecha desde', example: '2024-07-01T00:00:00.000Z' })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String, description: 'Fecha hasta', example: '2024-07-31T23:59:59.000Z' })
  @ApiQuery({ name: 'orderBy', required: false, type: String, description: 'Campo de ordenamiento', example: 'createdAt' })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'], description: 'Orden de clasificación' })
  @ApiResponse({
    status: 200,
    description: 'Comandas obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/Comanda' } },
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
  async obtenerConPaginacion(@Query() filtros: FiltrarComandasDto) {
    return await this.comandaService.obtenerConPaginacion(filtros);
  }

  @Get('resumen-caja-chica')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener resumen de caja chica',
    description: 'Obtiene un resumen de la caja chica',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de caja chica obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        totalCompletados: { type: 'number' },
        totalPendientes: { type: 'number' },
        montoNetoUSD: { type: 'number' },
        montoNetoARS: { type: 'number' },
        montoDisponibleTrasladoUSD: { type: 'number' },
        montoDisponibleTrasladoARS: { type: 'number' },
        totalIngresosUSD: { type: 'number' },
        totalIngresosARS: { type: 'number' },
        totalEgresosUSD: { type: 'number' },
        totalEgresosARS: { type: 'number' },
        comandasValidadasIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String, description: 'Fecha desde', example: '2024-07-01T00:00:00.000Z' })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String, description: 'Fecha hasta', example: '2024-07-31T23:59:59.000Z' })
  async obtenerResumenCajaChica(@Query() filtros: { fechaDesde: string, fechaHasta: string }): Promise<{
    totalCompletados: number;
    totalPendientes: number;
    montoNetoUSD: number;
    montoNetoARS: number;
    montoDisponibleTrasladoUSD: number;
    montoDisponibleTrasladoARS: number; 
    totalIngresosUSD: number;
    totalIngresosARS: number;
    totalEgresosUSD: number;
    totalEgresosARS: number;
    comandasValidadasIds: string[];
  }> {
    return await this.comandaService.getResumenCajaChica(filtros);
  }

  @Get('ultima')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener la última comanda',
    description: 'Obtiene la última comanda creada',
  })
  async obtenerUltimaComanda(): Promise<Comanda | null> {
    return await this.comandaService.getLastComanda();
  }

  @Get('existe/:numero')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Verificar si existe una comanda',
    description: 'Verifica si una comanda existe en la base de datos',
  })
  async existeComanda(@Param('numero') numero: string): Promise<boolean> {
    return await this.comandaService.existeComanda(numero);
  }

  @Get(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener comanda por ID',
    description: 'Obtiene una comanda específica por su ID',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Comanda obtenida exitosamente',
    type: Comanda,
  })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<Comanda> {
    return await this.comandaService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Actualizar comanda',
    description: 'Actualiza una comanda existente',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Comanda actualizada exitosamente',
    type: Comanda,
  })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() actualizarComandaDto: ActualizarComandaDto,
  ): Promise<Comanda> {
    return await this.comandaService.actualizar(id, actualizarComandaDto);
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar comanda',
    description: 'Elimina una comanda (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Comanda eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return await this.comandaService.eliminar(id);
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Restaurar comanda',
    description: 'Restaura una comanda eliminada',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Comanda restaurada exitosamente',
    type: Comanda,
  })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<Comanda> {
    return await this.comandaService.restaurar(id);
  }

  @Put(':id/estado')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({
    summary: 'Cambiar estado de comanda',
    description: 'Cambia el estado de una comanda',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Estado de comanda cambiado exitosamente',
    type: Comanda,
  })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('estadoDeComanda') estadoDeComanda: EstadoDeComanda,
  ): Promise<Comanda> {
    return await this.comandaService.cambiarEstado(id, estadoDeComanda);
  }
}
