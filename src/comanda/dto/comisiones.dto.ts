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
  @ApiProperty({
    description: 'Comisión de servicios',
    example: 45000.50,
  })
  servicios: number;

  @ApiProperty({
    description: 'Comisión de productos',
    example: 15000.25,
  })
  productos: number;

  @ApiProperty({
    description: 'Total de comisiones',
    example: 60000.75,
  })
  total: number;
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

  @ApiProperty({
    description: 'Total de servicios antes de comisión (con -10% aplicado)',
    example: 150000.00,
  })
  totalServicios: number;

  @ApiProperty({
    description: 'Total de productos antes de comisión (con -10% aplicado)',
    example: 50000.00,
  })
  totalProductos: number;

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
    description: 'Comisiones desglosadas por tipo',
  })
  comisiones: ComisionPorTipoDto;
}

export class TotalesGeneralesDto {
  @ApiProperty({
    description: 'Total de servicios sin descuento',
    example: 500000.00,
  })
  serviciosSinDescuento: number;

  @ApiProperty({
    description: 'Total de servicios con descuento del 10% aplicado',
    example: 450000.00,
  })
  serviciosConDescuento: number;

  @ApiProperty({
    description: 'Total de productos sin descuento',
    example: 150000.00,
  })
  productosSinDescuento: number;

  @ApiProperty({
    description: 'Total de productos con descuento del 10% aplicado',
    example: 135000.00,
  })
  productosConDescuento: number;

  @ApiProperty({
    description: 'Total general sin descuento (servicios + productos)',
    example: 650000.00,
  })
  totalSinDescuento: number;

  @ApiProperty({
    description: 'Total general con descuento - Saldo de caja',
    example: 585000.00,
  })
  totalConDescuento: number;
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
    description: 'Total general de comisiones',
    example: 120000.50,
  })
  totalComisiones: number;
}

