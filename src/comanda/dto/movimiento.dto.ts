import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsNotEmpty,
  IsArray,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CrearMovimientoDto {
  @ApiProperty({
    description: 'Monto del movimiento en ARS',
    example: 25000.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  efectivoARS: number;

  @ApiProperty({
    description: 'Monto del movimiento en USD',
    example: 25000.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  efectivoUSD: number;

  @ApiProperty({
    description: 'Monto del movimiento',
    example: 25000.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  montoARS: number;

  @ApiPropertyOptional({
    description: 'Indica si el movimiento es un ingreso',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  esIngreso?: boolean;

  @ApiPropertyOptional({
    description: 'Comentario adicional sobre el movimiento',
    example: 'Pago de servicios'
  })
  @IsOptional()
  @IsString()
  comentario: string;

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
    description: 'Filtrar por ID de personal',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  personalId?: string;

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
      description: 'Fecha desde',
      example: '2024-07-01T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    fechaDesde?: string;
  
    @ApiPropertyOptional({
      description: 'Fecha hasta',
      example: '2024-07-31T23:59:59.000Z',
    })
    @IsOptional()
    @IsDateString()
    fechaHasta?: string;

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