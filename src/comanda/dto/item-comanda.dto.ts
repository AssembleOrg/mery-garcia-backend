import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CrearItemComandaDto {
  @ApiProperty({
    description: 'Nombre del item',
    example: 'Tatuaje pequeño',
    maxLength: 150
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({
    description: 'Precio del item',
    example: 25000.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  @Type(() => Number)
  precio: number;

  @ApiProperty({
    description: 'Cantidad del item',
    example: 1,
    minimum: 1
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  cantidad: number;

  @ApiProperty({
    description: 'ID de la comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsOptional()
  comandaId?: string;

  @ApiPropertyOptional({
    description: 'ID del producto/servicio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  productoServicioId?: string;

  @ApiPropertyOptional({
    description: 'ID del tipo de item',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  tipoId?: string;

  @ApiPropertyOptional({
    description: 'ID del trabajador',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  trabajadorId?: string;

  @ApiPropertyOptional({
    description: 'Descuento aplicado al item',
    example: 0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  descuento?: number;

  @ApiPropertyOptional({
    description: 'Subtotal del item',
    example: 25000.50,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  subtotal?: number;
}

export class ActualizarItemComandaDto extends PartialType(CrearItemComandaDto) {}

export class FiltrarItemsComandaDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre (búsqueda parcial)',
    example: 'Tatuaje'
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  comandaId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de producto/servicio',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  productoServicioId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de trabajador',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  trabajadorId?: string;

  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
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
  limit?: number;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    example: 'nombre',
    enum: ['nombre', 'precio', 'cantidad', 'createdAt'],
    default: 'nombre'
  })
  @IsOptional()
  @IsString()
  orderBy?: 'nombre' | 'precio' | 'cantidad' | 'createdAt';

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