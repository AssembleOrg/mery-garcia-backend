import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CrearUnidadNegocioDto {
  @ApiProperty({
    description: 'Nombre de la unidad de negocio',
    example: 'Tattoo',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}

export class ActualizarUnidadNegocioDto extends PartialType(CrearUnidadNegocioDto) {}

export class FiltrarUnidadesNegocioDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre (búsqueda parcial)',
    example: 'Tattoo'
  })
  @IsOptional()
  @IsString()
  nombre?: string;

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
    enum: ['nombre', 'createdAt'],
    default: 'nombre'
  })
  @IsOptional()
  @IsString()
  orderBy?: 'nombre' | 'createdAt';

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