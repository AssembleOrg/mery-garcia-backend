import { IsOptional, IsString, IsNumber, Min, Max, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { TipoAccion } from 'src/enums/TipoAccion.enum';

export class FiltrarAuditoriaDto {
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
        description: 'Número de elementos a saltar (offset)',
        example: 0,
        minimum: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    offset?: number = 0;

    @ApiPropertyOptional({
        description: 'Término de búsqueda para descripción',
        example: 'Producto actualizado',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Filtrar por módulo del sistema',
        enum: ModuloSistema,
        example: ModuloSistema.COMANDA,
    })
    @IsOptional()
    @IsEnum(ModuloSistema)
    modulo?: ModuloSistema;

    @ApiPropertyOptional({
        description: 'Filtrar por tipo de acción',
        enum: TipoAccion,
        example: TipoAccion.COMANDA_CREADA,
    })
    @IsOptional()
    @IsEnum(TipoAccion)
    tipoAccion?: TipoAccion;

    @ApiPropertyOptional({
        description: 'Filtrar por ID de usuario que realizó la acción',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsOptional()
    @IsUUID()
    usuarioId?: string;

    @ApiPropertyOptional({
        description: 'Filtrar por ID de entidad afectada',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsOptional()
    @IsUUID()
    entidadId?: string;

    @ApiPropertyOptional({
        description: 'Fecha de inicio para filtrar auditorías (YYYY-MM-DD)',
        example: '2025-08-05',
    })
    @IsOptional()
    @IsString()
    fechaInicio?: string;

    @ApiPropertyOptional({
        description: 'Fecha de fin para filtrar auditorías (YYYY-MM-DD)',
        example: '2025-08-05',
    })
    @IsOptional()
    @IsString()
    fechaFin?: string;

    @ApiPropertyOptional({
        description: 'Ordenar por campo',
        example: 'createdAt',
        enum: ['createdAt', 'tipoAccion', 'modulo', 'descripcion', 'entidadId'],
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
    orderDirection?: 'ASC' | 'DESC' = 'DESC';
} 