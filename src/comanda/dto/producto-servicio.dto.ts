import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  MaxLength,
  Min,
  Max,
  IsNotEmpty,
  IsInt,
  IsUUID
} from 'class-validator';
import { TipoProductoServicio } from '../entities/productoServicio.entity';
import { Transform } from 'class-transformer';

export class CrearProductoServicioDto {
  @ApiProperty({
    description: 'Nombre del producto o servicio',
    example: 'Tatuaje pequeño',
    maxLength: 150
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({
    description: 'Precio base del producto/servicio',
    example: 25000.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  precio: number;

  @ApiProperty({
    description: 'Tipo de producto o servicio',
    enum: TipoProductoServicio,
    example: TipoProductoServicio.SERVICIO
  })
  @IsEnum(TipoProductoServicio)
  tipo: TipoProductoServicio;

  @ApiProperty({
    description: 'ID de la unidad de negocio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  unidadNegocioId: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada del producto/servicio',
    example: 'Tatuaje pequeño hasta 5cm, incluye diseño personalizado'
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Estado activo del producto/servicio',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Duración estimada en minutos (para servicios)',
    example: 120,
    minimum: 1
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  duracion?: number;

  @ApiPropertyOptional({
    description: 'Código de barras del producto',
    example: '1234567890123',
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoBarras?: string;

  @ApiPropertyOptional({
    description: 'Indica si tiene precio congelado en ARS',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  esPrecioCongelado?: boolean;

  @ApiPropertyOptional({
    description: 'Precio fijo en ARS (si está congelado)',
    example: 15000.00,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  precioFijoARS?: number;
}

export class ActualizarProductoServicioDto extends PartialType(CrearProductoServicioDto) {}

export class FiltrarProductosServiciosDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre (búsqueda parcial)',
    example: 'Tatuaje'
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo',
    enum: TipoProductoServicio
  })
  @IsOptional()
  @IsEnum(TipoProductoServicio)
  tipo?: TipoProductoServicio;

  @ApiPropertyOptional({
    description: 'Filtrar por unidad de negocio ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  unidadNegocioId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo',
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Elementos por página',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por precio congelado',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  esPrecioCongelado?: boolean;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    example: 'nombre',
    enum: ['nombre', 'precio', 'tipo', 'unidadNegocioId', 'createdAt'],
    default: 'nombre'
  })
  @IsOptional()
  @IsString()
  orderBy?: 'nombre' | 'precio' | 'tipo' | 'unidadNegocioId' | 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
    default: 'ASC'
  })
  @IsOptional()
  @IsString()
  orderDirection?: 'ASC' | 'DESC';
}
