import { IsOptional, IsString, IsNumber, Min, Max, IsEnum, IsUUID, IsDateString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDeComanda, EstadoDeComanda } from '../entities/Comanda.entity';

export class FiltrarComandasDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Número de elementos por página',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Término de búsqueda para número de comanda',
    example: 'COM-2024',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Tipo de comanda',
    enum: TipoDeComanda,
  })
  @IsOptional()
  @IsEnum(TipoDeComanda)
  tipoDeComanda?: TipoDeComanda;

  @ApiPropertyOptional({
    description: 'Incluir traspasadas',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  incluirTraspasadas?: boolean;

  @ApiPropertyOptional({
    description: 'Estado de la comanda',
    enum: EstadoDeComanda,
  })
  @IsOptional()
  @IsEnum(EstadoDeComanda)
  estadoDeComanda?: EstadoDeComanda;

  @ApiPropertyOptional({
    description: 'ID del negocio',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  unidadNegocioId?: string;

  @ApiPropertyOptional({
    description: 'ID del negocio',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  servicioId?: string;

  @ApiPropertyOptional({
    description: 'ID del cliente',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @ApiPropertyOptional({
    description: 'ID del personal que creó la comanda',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  creadoPorNombre?: string;

  @ApiPropertyOptional({
    description: 'Nombre del trabajador',
    example: 'Juan Perez',
  })
  @IsOptional()
  @IsString()
  trabajadorNombre?: string;

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
    description: 'Ordenar por campo',
    example: 'createdAt',
    enum: ['createdAt', 'numero', 'tipoDeComanda', 'estadoDeComanda'],
  })
  @IsOptional()
  @IsString()
  orderBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Orden de clasificación',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC' = 'DESC';
} 