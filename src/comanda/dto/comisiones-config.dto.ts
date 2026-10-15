import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BaseCategoriaDto {
  @ApiProperty({ description: 'Categoría de servicio' })
  @IsUUID()
  categoriaId: string;

  @ApiProperty({ description: 'Monto base en ARS', example: 45000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoBase: number;
}

export class ActualizarEsquemaComisionDto {
  @ApiPropertyOptional({ description: 'Porcentaje mínimo (o único) del rango', example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeMin?: number;

  @ApiPropertyOptional({ description: 'Tope del rango; null = sin rango', example: 35, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeMax?: number | null;

  @ApiPropertyOptional({ description: 'Porcentaje sobre productos (precio en efectivo)', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  productosPorcentaje?: number | null;

  @ApiPropertyOptional({ description: 'Desde qué día rige el esquema por base fija (YYYY-MM-DD); null lo desactiva', example: '2026-10-01', nullable: true })
  @IsOptional()
  @IsDateString()
  baseDesde?: string | null;

  @ApiPropertyOptional({ type: [BaseCategoriaDto], description: 'Reemplaza todas las bases de la trabajadora' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseCategoriaDto)
  bases?: BaseCategoriaDto[];
}

export class ConfirmarPorcentajeMesDto {
  @ApiProperty({ description: 'Porcentaje confirmado al cierre del mes', example: 32 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}
