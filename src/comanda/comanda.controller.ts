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
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolPersonal } from 'src/enums/RolPersonal.enum';
import { ComandaService } from './comanda.service';
import { CrearComandaDto } from './dto/crear-comanda.dto';
import { ActualizarComandaDto } from './dto/actualizar-comanda.dto';
import { FiltrarComandasDto } from './dto/filtrar-comandas.dto';
import { EstadoComanda } from './entities/Comanda.entity';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';

@ApiTags('comandas')
@Controller('comandas')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ComandaController {
  constructor(private readonly comandaService: ComandaService) {}

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Crear una nueva comanda',
    description: 'Crea una nueva comanda con sus items, cliente, personal y métodos de pago'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Comanda creada exitosamente',
    schema: {
      type: 'object',
      properties: {
        comanda: { type: 'object' },
        totalItems: { type: 'number' },
        totalCalculado: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o comanda duplicada' })
  @ApiResponse({ status: 404, description: 'Cliente o personal no encontrado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async crearComanda(
    @Body() crearComandaDto: CrearComandaDto,
    @Request() req,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return await this.comandaService.crearComanda(
      crearComandaDto,
      req.user,
      ipAddress,
      userAgent,
    );
  }

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Obtener comandas con filtros',
    description: 'Obtiene una lista paginada de comandas con filtros opcionales'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Comandas obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        comandas: { type: 'array' },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerComandas(@Query() filtros: FiltrarComandasDto) {
    return await this.comandaService.filtrarComandas(filtros);
  }

  @Get(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 'uuid-de-la-comanda' })
  @ApiOperation({ 
    summary: 'Obtener comanda por ID',
    description: 'Obtiene una comanda específica con todas sus relaciones'
  })
  @ApiResponse({ status: 200, description: 'Comanda obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerComanda(@Param('id') id: string) {
    return await this.comandaService.obtenerComanda(id);
  }

  @Get('numero/:numero')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiParam({ name: 'numero', description: 'Número de la comanda', example: 'CMD-2024-001' })
  @ApiOperation({ 
    summary: 'Obtener comanda por número',
    description: 'Obtiene una comanda específica por su número único'
  })
  @ApiResponse({ status: 200, description: 'Comanda obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerComandaPorNumero(@Param('numero') numero: string) {
    return await this.comandaService.obtenerComandaPorNumero(numero);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 'uuid-de-la-comanda' })
  @ApiOperation({ 
    summary: 'Actualizar comanda',
    description: 'Actualiza una comanda existente con los datos proporcionados'
  })
  @ApiResponse({ status: 200, description: 'Comanda actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o comanda duplicada' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async actualizarComanda(
    @Param('id') id: string,
    @Body() actualizarComandaDto: ActualizarComandaDto,
    @Request() req,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return await this.comandaService.actualizarComanda(
      id,
      actualizarComandaDto,
      req.user,
      ipAddress,
      userAgent,
    );
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN)
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 'uuid-de-la-comanda' })
  @ApiOperation({ 
    summary: 'Eliminar comanda (soft delete)',
    description: 'Elimina una comanda de forma lógica (soft delete)'
  })
  @ApiResponse({ status: 200, description: 'Comanda eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async eliminarComanda(
    @Param('id') id: string,
    @Request() req,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.comandaService.eliminarComanda(
      id,
      req.user,
      ipAddress,
      userAgent,
    );

    return { message: 'Comanda eliminada exitosamente' };
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN)
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 'uuid-de-la-comanda' })
  @ApiOperation({ 
    summary: 'Restaurar comanda eliminada',
    description: 'Restaura una comanda que fue eliminada (soft delete)'
  })
  @ApiResponse({ status: 200, description: 'Comanda restaurada exitosamente' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  @ApiResponse({ status: 400, description: 'La comanda no está eliminada' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async restaurarComanda(
    @Param('id') id: string,
    @Request() req,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return await this.comandaService.restaurarComanda(
      id,
      req.user,
      ipAddress,
      userAgent,
    );
  }

  @Put(':id/estado')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiParam({ name: 'id', description: 'ID de la comanda', example: 'uuid-de-la-comanda' })
  @ApiOperation({ 
    summary: 'Cambiar estado de comanda',
    description: 'Cambia el estado de una comanda (pendiente, en_proceso, completado, cancelado)'
  })
  @ApiResponse({ status: 200, description: 'Estado de comanda cambiado exitosamente' })
  @ApiResponse({ status: 404, description: 'Comanda no encontrada' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async cambiarEstadoComanda(
    @Param('id') id: string,
    @Body('estado') estado: EstadoComanda,
    @Request() req,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return await this.comandaService.cambiarEstadoComanda(
      id,
      estado,
      req.user,
      ipAddress,
      userAgent,
    );
  }

  @Get('estadisticas/resumen')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Obtener estadísticas de comandas',
    description: 'Obtiene un resumen estadístico de las comandas'
  })
  @ApiQuery({ name: 'fechaInicio', required: false, description: 'Fecha de inicio (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fechaFin', required: false, description: 'Fecha de fin (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerEstadisticas(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    // Implementar lógica de estadísticas
    const filtros: Partial<FiltrarComandasDto> = {};
    if (fechaInicio) filtros.fechaInicio = fechaInicio;
    if (fechaFin) filtros.fechaFin = fechaFin;

    const comandas = await this.comandaService.filtrarComandas(filtros);
   

    const estadisticas = {
      totalComandas: comandas.total,
      totalIngresos: comandas.comandas.filter(c => c.tipo?.nombre === 'Ingreso').length,
      totalEgresos: comandas.comandas.filter(c => c.tipo?.nombre === 'Egreso').length,
      totalPendientes: comandas.comandas.filter(c => c.estado === EstadoComanda.PENDIENTE).length,
      totalEnProceso: comandas.comandas.filter(c => c.estado === EstadoComanda.EN_PROCESO).length,
      totalCompletadas: comandas.comandas.filter(c => c.estado === EstadoComanda.COMPLETADO).length,
      totalCanceladas: comandas.comandas.filter(c => c.estado === EstadoComanda.CANCELADO).length,
      montoTotal: comandas.comandas.reduce((sum, c) => sum + c.totalFinal, 0),
      montoPromedio: comandas.comandas.length > 0 
        ? comandas.comandas.reduce((sum, c) => sum + c.totalFinal, 0) / comandas.comandas.length 
        : 0,
    };

    return estadisticas;
  }

  @Get('exportar')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ 
    summary: 'Exportar comandas',
    description: 'Exporta las comandas filtradas en formato CSV, PDF o Excel'
  })
  @ApiQuery({ 
    name: 'estado', 
    enum: EstadoComanda, 
    required: false,
    description: 'Filtrar por estado de comanda'
  })
  @ApiQuery({ 
    name: 'fechaInicio', 
    type: String, 
    required: false,
    description: 'Fecha de inicio (YYYY-MM-DD)',
    example: '2024-01-01'
  })
  @ApiQuery({ 
    name: 'fechaFin', 
    type: String, 
    required: false,
    description: 'Fecha de fin (YYYY-MM-DD)',
    example: '2024-12-31'
  })
  @ApiQuery({ 
    name: 'clienteId', 
    type: String, 
    required: false,
    description: 'Filtrar por ID de cliente'
  })
  @ApiQuery({ 
    name: 'personalId', 
    type: String, 
    required: false,
    description: 'Filtrar por ID de personal'
  })
  @ApiQuery({ 
    name: 'unidadNegocio', 
    type: String, 
    required: false,
    description: 'Filtrar por unidad de negocio'
  })
  @ApiQuery({ 
    name: 'tipoId', 
    type: String, 
    required: false,
    description: 'Filtrar por ID de tipo'
  })
  @ApiQuery({ 
    name: 'tipoItemId', 
    type: String, 
    required: false,
    description: 'Filtrar por ID de tipo de item'
  })
  @ApiQuery({ 
    name: 'formato', 
    enum: ['csv', 'pdf', 'excel'], 
    required: false,
    description: 'Formato de exportación (default: csv)',
    example: 'csv'
  })
  @ApiResponse({ status: 200, description: 'Archivo exportado exitosamente' })
  @ApiResponse({ status: 400, description: 'Formato de exportación no válido' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async exportarComandas(
    @Res() res: Response,
    @Query('estado') estado?: EstadoComanda,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('clienteId') clienteId?: string,
    @Query('personalId') personalId?: string,
    @Query('unidadNegocio') unidadNegocio?: string,
    @Query('tipoId') tipoId?: string,
    @Query('tipoItemId') tipoItemId?: string,
    @Query('formato') formato?: 'csv' | 'pdf' | 'excel',
  ) {
    const filtros: Partial<FiltrarComandasDto> = {
      estado,
      fechaInicio,
      fechaFin,
      clienteId,
      personalPrincipalId: personalId,
      unidadNegocio: unidadNegocio as UnidadNegocio,
      tipoId,
      tipoItemId,
    };

    const resultado = await this.comandaService.exportarComandas(filtros, formato || 'csv');

    res.setHeader('Content-Type', resultado.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${resultado.filename}"`);
    
    if (typeof resultado.data === 'string') {
      res.send(resultado.data);
    } else {
      res.send(resultado.data);
    }
  }
}
