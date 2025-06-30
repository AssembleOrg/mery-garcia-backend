import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DolarService, DolarResponse } from '../services/dolar.service';

@ApiTags('Dólar')
@Controller('dolar')
export class DolarController {
  constructor(private readonly dolarService: DolarService) {}

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
  async obtenerHistorial(@Query('limit') limit?: number): Promise<DolarResponse[]> {
    return this.dolarService.obtenerHistorialDolar(limit);
  }
} 