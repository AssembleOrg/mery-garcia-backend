import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsNotEmpty,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CrearMovimientoDto {
  @ApiProperty({
    description: 'Monto del movimiento',
    example: 25000.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  montoARS: number;

  @ApiProperty({
    description: 'Monto del movimiento',
    example: 25000.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  montoUSD: number;

  @ApiProperty({
    description: 'Residual del movimiento',
    example: 0,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  residualARS: number;

  @ApiProperty({
    description: 'Residual del movimiento',
    example: 0,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  residualUSD: number;

  @ApiProperty({
    description: 'ID de la comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsArray()
  @IsUUID(4, { each: true })
  comandasValidadasIds: string[];

  @ApiPropertyOptional({
    description: 'ID del personal',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  personalId?: string;
}

export class ActualizarMovimientoDto extends PartialType(CrearMovimientoDto) {}

export class FiltrarMovimientosDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de comanda',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  comandaId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de personal',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  personalId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por monto mínimo',
    example: 1000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  montoMinimo?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por monto máximo',
    example: 50000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  montoMaximo?: number;

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
    example: 'monto',
    enum: ['monto', 'residual', 'createdAt'],
    default: 'createdAt'
  })
  @IsOptional()
  @IsString()
  orderBy?: 'monto' | 'residual' | 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    default: 'DESC'
  })
  @IsOptional()
  @IsString()
  orderDirection?: 'ASC' | 'DESC';
} 