import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductoServicioItemDto {
  @ApiProperty({
    description: 'Nombre del producto o servicio',
    example: 'NANOBLADING',
  })
  nombre: string;

  @ApiProperty({
    description: 'Cantidad vendida',
    example: 3,
  })
  cantidad: number;

  @ApiProperty({
    description: 'Tipo: SERVICIO o PRODUCTO',
    example: 'SERVICIO',
  })
  tipo: string;
}

export class FiltrarComisionesDto {
  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango (formato: YYYY-MM-DD)',
    example: '2025-10-01',
  })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del rango (formato: YYYY-MM-DD)',
    example: '2025-10-31',
  })
  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @ApiPropertyOptional({
    description: 'Valor del dólar a utilizar para conversiones USD a ARS. Si no se proporciona, se usa el valorDolar de cada comanda individual.',
    example: 1356,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  dolar?: number;
}

export class ComisionPorTipoDto {
  @ApiProperty({ description: 'Comisión de servicios en ARS', example: 45000.5 })
  serviciosARS: number;

  @ApiProperty({ description: 'Comisión de servicios en USD', example: 8311.56 })
  serviciosUSD: number;

  @ApiProperty({ description: 'Comisión de productos en ARS', example: 15000.25 })
  productosARS: number;

  @ApiProperty({ description: 'Comisión de productos en USD', example: 54.62 })
  productosUSD: number;

  @ApiProperty({ description: 'Total de comisiones en ARS', example: 60000.75 })
  totalARS: number;

  @ApiProperty({ description: 'Total de comisiones en USD', example: 8366.18 })
  totalUSD: number;
}

export class ComisionTrabajadorDto {
  @ApiProperty({
    description: 'ID del trabajador',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trabajadorId: string;

  @ApiProperty({
    description: 'Nombre del trabajador',
    example: 'Rosario',
  })
  nombre: string;

  @ApiProperty({ description: 'Total de servicios en ARS', example: 150000.0 })
  serviciosARS: number;

  @ApiProperty({ description: 'Total de servicios en USD', example: 27705.2 })
  serviciosUSD: number;

  @ApiProperty({ description: 'Total de productos en ARS', example: 50000.0 })
  productosARS: number;

  @ApiProperty({ description: 'Total de productos en USD', example: 546.29 })
  productosUSD: number;

  @ApiProperty({
    description: 'Cantidad de consultas (solo para Rosario)',
    example: 5,
  })
  cantidadConsultas: number;

  @ApiProperty({
    description: 'Total de consultas = cantidadConsultas * 10 (solo para Rosario)',
    example: 50.00,
  })
  totalConsultas: number;

  @ApiProperty({
    description: 'Cantidad de items por unidad de negocio',
    example: { 'Cosmetic Tatto': 5, 'Estilismo': 3 },
  })
  unidadesNegocio: Record<string, number>;

  @ApiProperty({
    description: 'Detalle de productos/servicios vendidos',
    type: [ProductoServicioItemDto],
  })
  productosServicios: ProductoServicioItemDto[];

  @ApiProperty({
    description: 'Cantidad de servicios por categoría (A, B, C...)',
    example: [{ id: 'uuid', nombre: 'Categoría A', orden: 1, cantidad: 12 }],
  })
  categorias: { id: string; nombre: string; orden: number; cantidad: number }[];

  @ApiProperty({ description: 'Servicios sin categoría asignada (sin contar consultas)', example: 0 })
  serviciosSinCategoria: number;

  @ApiProperty({
    description: 'Comisiones desglosadas por tipo',
  })
  comisiones: ComisionPorTipoDto;
}

export class TotalesGeneralesDto {
  @ApiProperty({ description: 'Total de servicios en ARS', example: 500000.0 })
  serviciosARS: number;

  @ApiProperty({ description: 'Total de servicios en USD', example: 27705.2 })
  serviciosUSD: number;

  @ApiProperty({ description: 'Total de productos en ARS', example: 150000.0 })
  productosARS: number;

  @ApiProperty({ description: 'Total de productos en USD', example: 546.29 })
  productosUSD: number;

  @ApiProperty({ description: 'Total general en ARS (servicios + productos)', example: 650000.0 })
  totalARS: number;

  @ApiProperty({ description: 'Total general en USD (servicios + productos)', example: 28251.49 })
  totalUSD: number;
}

export class ResumenComisionesDto {
  @ApiProperty({
    description: 'Fecha de inicio del rango consultado',
    example: '2025-10-01',
  })
  fechaDesde: string;

  @ApiProperty({
    description: 'Fecha de fin del rango consultado',
    example: '2025-10-31',
  })
  fechaHasta: string;

  @ApiProperty({
    description: 'Comisiones por trabajador',
    type: [ComisionTrabajadorDto],
  })
  trabajadores: ComisionTrabajadorDto[];

  @ApiProperty({
    description: 'Totales generales',
    type: TotalesGeneralesDto,
  })
  totales: TotalesGeneralesDto;

  @ApiProperty({
    description: 'Total general de comisiones en ARS',
    example: 120000.50,
  })
  totalComisionesARS: number;

  @ApiProperty({
    description: 'Total general de comisiones en USD',
    example: 8366.18,
  })
  totalComisionesUSD: number;
}

