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
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { CrearComandaDto } from './dto/crear-comanda.dto';
import { ActualizarComandaDto } from './dto/actualizar-comanda.dto';
import { FiltrarComandasDto } from './dto/filtrar-comandas.dto';
import { EstadoDeComanda } from './entities/Comanda.entity';
import { Comanda } from './entities/Comanda.entity';
import { CrearEgresoDto } from './dto/crear-egreso.dto';
import { Egreso } from './entities/egreso.entity';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { LogAction } from 'src/decorators/log-action.decorator';
import { Audit } from 'src/decorators/audit.decorator';
import { Movimiento } from './entities/movimiento.entity';

@ApiTags('Comandas')
@Controller('comandas')
// @UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ComandaController {
  constructor(
    private readonly comandaService: ComandaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @LogAction({ action: 'CREATE', entityType: 'Comanda' })
  @Audit({ 
    action: 'CREATE', 
    entityType: 'Comanda',
    description: 'Creación de comanda con items y métodos de pago',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
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
    const comanda = await this.comandaService.crear(crearComandaDto);
    
    return comanda;
  }

  @Post('egreso')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @LogAction({ action: 'CREATE', entityType: 'Comanda', description: 'Egreso creado' })
  @Audit({ 
    action: 'CREATE', 
    entityType: 'Comanda',
    description: 'Creación de egreso con detalle de gastos',
    includeRelations: true
  })
  @ApiOperation({
    summary: 'Crear un egreso',
    description: 'Crea un egreso con todos sus datos',
  })
  async crearComandaEgreso(@Body() crearEgresoDto: CrearEgresoDto): Promise<Comanda> {
    const comanda = await this.comandaService.crearEgreso(crearEgresoDto);
    
    return comanda;
  }

  @Post('actualizar-prepagos')
  // @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @LogAction({ action: 'UPDATE', entityType: 'Comanda', description: 'Actualización masiva de prepagos en comandas' })
  @Audit({ 
    action: 'UPDATE', 
    entityType: 'Comanda',
    description: 'Actualización masiva de campos prepagoARSID y prepagoUSDID basándose en señas',
    includeRelations: true
  })
  @ApiOperation({
    summary: 'Actualizar prepagos de comandas',
    description: 'Actualiza automáticamente los campos prepagoARSID y prepagoUSDID de todas las comandas basándose en las señas aplicadas',
  })
  @ApiResponse({
    status: 200,
    description: 'Prepagos actualizados exitosamente',
    schema: {
      type: 'object',
      properties: {
        totalComandas: { type: 'number', description: 'Total de comandas procesadas' },
        comandasActualizadas: { type: 'number', description: 'Comandas que fueron actualizadas' },
        comandasConSeñas: { type: 'number', description: 'Comandas que contienen señas' },
        errores: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Lista de errores encontrados durante el proceso'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Error en el proceso de actualización' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async actualizarPrepagosComandas() {
    return await this.comandaService.actualizarPrepagosComandas();
  }

  @Get('maximo-ars-usd-egreso')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener el máximo ARS y USD de egreso',
    description: 'Obtiene el máximo ARS y USD de egreso',
  })

  async obtenerMaximoArsUsdEgreso(): Promise<{
    ars: number;
    usd: number;
  }> {
    return await this.comandaService.obtenerMaximoArsUsdEgreso();
  }

  @Get('ultimo-residual')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener el último movimiento',
    description: 'Obtiene el último movimiento creado',
  })
  async obtenerUltimoMovimiento(): Promise<Partial<Movimiento>> {
    return await this.comandaService.ultimoMovimiento(false);
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

  @Get('resumen-caja-por-metodo-pago')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener resumen de caja diario con desglose por método de pago',
    description: 'Obtiene un resumen de la caja chica para un día específico con los montos desglosados por tipo de método de pago (efectivo, tarjeta, transferencia, cheque, QR, gift card) en ambas monedas (ARS y USD). Si no se proporciona fecha, se usa el día actual por defecto. Ideal para datepickers de resumen diario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de caja diario por método de pago obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        totalCompletados: { type: 'number', description: 'Total de comandas completadas (validadas)', example: 25 },
        totalPendientes: { type: 'number', description: 'Total de comandas pendientes', example: 5 },
        montoNetoUSD: { type: 'number', description: 'Monto neto en dólares (ingresos - egresos)', example: 1500.75 },
        montoNetoARS: { type: 'number', description: 'Monto neto en pesos (ingresos - egresos)', example: 15000.50 },
        montoDisponibleTrasladoUSD: { type: 'number', description: 'Monto disponible para traslado en dólares', example: 1500.75 },
        montoDisponibleTrasladoARS: { type: 'number', description: 'Monto disponible para traslado en pesos', example: 15000.50 },
        totalIngresosUSD: { type: 'number', description: 'Total de ingresos en dólares', example: 2000.00 },
        totalIngresosARS: { type: 'number', description: 'Total de ingresos en pesos', example: 20000.00 },
        totalEgresosUSD: { type: 'number', description: 'Total de egresos en dólares', example: 500.25 },
        totalEgresosARS: { type: 'number', description: 'Total de egresos en pesos', example: 5000.50 },
        comandasValidadasIds: { type: 'array', items: { type: 'string' }, description: 'IDs de las comandas validadas', example: ['uuid-1', 'uuid-2'] },
        porMetodoPago: {
          type: 'object',
          description: 'Desglose de ingresos por método de pago y moneda',
          properties: {
            EFECTIVO: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            TARJETA: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            TRANSFERENCIA: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            CHEQUE: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            QR: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            GIFT_CARD: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
          },
        },
        porMetodoPagoEgresos: {
          type: 'object',
          description: 'Desglose de egresos por método de pago y moneda',
          properties: {
            EFECTIVO: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            TARJETA: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            TRANSFERENCIA: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            CHEQUE: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            QR: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
            GIFT_CARD: { type: 'object', properties: { ARS: { type: 'number' }, USD: { type: 'number' } } },
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'fecha', required: false, type: String, description: 'Fecha del día a consultar (opcional, por defecto hoy). Formato: YYYY-MM-DD o ISO 8601', example: '2024-10-02' })
  async obtenerResumenCajaPorMetodoPago(@Query() filtros: { fecha?: string }) {
    return await this.comandaService.getResumenCajaPorMetodoPago(filtros);
  }

  @Get('ultima')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({
    summary: 'Obtener la última comanda',
    description: 'Obtiene la última comanda creada',
  })
  async obtenerUltimaComanda(): Promise<{ numero: string } | null> {
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
  @ApiResponse({ status: 400, description: 'Datos inválidos o número de comanda duplicado' })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() actualizarComandaDto: Partial<CrearComandaDto>,
  ): Promise<Comanda> {
    const comanda = await this.comandaService.actualizar(id, actualizarComandaDto);
    
    return comanda;
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
    const comanda = await this.comandaService.obtenerPorId(id);
    await this.comandaService.eliminar(id);
    
    // Registrar auditoría

  }

  //hard D
  @Delete(':id/hard')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar comanda permanentemente',
    description: 'Elimina una comanda de forma permanente junto con todos sus elementos relacionados (items, métodos de pago, descuentos, egresos). También reactiva los prepagos que estaban siendo utilizados por esta comanda.',
  })
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Comanda eliminada permanentemente' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  @LogAction({ action: 'DELETE', entityType: 'Comanda', description: 'Eliminación permanente de comanda' })
  async eliminarHard(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.comandaService.eliminarHard(id);
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
    const comanda = await this.comandaService.restaurar(id);
    
    // Registrar auditoría

    
    return comanda;
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
    const comanda = await this.comandaService.cambiarEstado(id, estadoDeComanda);
    
    // Registrar auditoría
    
    return comanda;
  }
}
