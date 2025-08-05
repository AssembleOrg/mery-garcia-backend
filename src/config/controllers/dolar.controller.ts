import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { DolarService, DolarResponse } from '../services/dolar.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { ActualizarDolarDto } from '../dto/actualizar-dolar.dto';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@ApiTags('Dólar')
@Controller('dolar')
export class DolarController {
  constructor(
    private readonly dolarService: DolarService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get('cotizacion')
  @ApiOperation({ summary: 'Obtener cotización actual del dólar blue' })
  @ApiResponse({
    status: 200,
    description: 'Cotización del dólar obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        compra: { type: 'number', example: 1190 },
        venta: { type: 'number', example: 1210 },
        casa: { type: 'string', example: 'blue' },
        nombre: { type: 'string', example: 'Blue' },
        moneda: { type: 'string', example: 'USD' },
        fechaActualizacion: { type: 'string', example: '2025-06-29T20:57:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async obtenerCotizacion(): Promise<DolarResponse> {
    return this.dolarService.obtenerDolarActual();
  }

  @Get('ultimo')
  @ApiOperation({ summary: 'Obtener el último update de dólar guardado en el sistema' })
  @ApiResponse({
    status: 200,
    description: 'Último update de dólar obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        compra: { type: 'number', example: 1190 },
        venta: { type: 'number', example: 1210 },
        casa: { type: 'string', example: 'blue' },
        nombre: { type: 'string', example: 'Blue' },
        moneda: { type: 'string', example: 'USD' },
        fechaActualizacion: { type: 'string', example: '2025-06-29T20:57:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No se encontró ningún update de dólar' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async obtenerUltimoUpdate(): Promise<DolarResponse | null> {
    return this.dolarService.obtenerUltimoUpdatePorFecha();
  }

  @Get('historial')
  @ApiOperation({ summary: 'Obtener historial de cotizaciones del dólar' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número máximo de registros a retornar (default: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de cotizaciones obtenido exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          compra: { type: 'number', example: 1190 },
          venta: { type: 'number', example: 1210 },
          casa: { type: 'string', example: 'blue' },
          nombre: { type: 'string', example: 'Blue' },
          moneda: { type: 'string', example: 'USD' },
          fechaActualizacion: { type: 'string', example: '2025-06-29T20:57:00.000Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  @ApiResponse({ status: 404, description: 'No se encontró ningún update de dólar' })
  async obtenerHistorial(@Query('limit') limit?: number): Promise<DolarResponse[]> {
    return this.dolarService.obtenerHistorialDolar(limit);
  }
  
  @Post('cotizacion')
  @Audit({ 
    action: 'UPDATE', 
    entityType: 'Dolar',
    description: 'Cotización del dólar actualizada en el sistema',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  @ApiOperation({ summary: 'Crear cotización del dólar' })
  @ApiBody({ type: ActualizarDolarDto })
  async actualizarCotizacion(@Body() dolar: ActualizarDolarDto): Promise<DolarResponse> {
    const resultado = await this.dolarService.actualizarDolarManualmente(dolar);
    
    return resultado;
  }
} 