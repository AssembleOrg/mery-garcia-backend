import { IsOptional, IsString, IsNumber, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FiltrarClientesDto {
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
        description: 'Término de búsqueda para nombre, email o teléfono',
        example: 'Juan',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Filtrar por nombre específico',
        example: 'Juan Pérez',
    })
    @IsOptional()
    @IsString()
    nombre?: string;

    @ApiPropertyOptional({
        description: 'Ordenar por campo',
        example: 'nombre',
        enum: ['nombre', 'fechaRegistro', 'createdAt', 'tieneSeñas'],
    })
    @IsOptional()
    @IsString()
    orderBy?: string = 'nombre';

    @ApiPropertyOptional({
        description: 'Orden de clasificación',
        example: 'ASC',
        enum: ['ASC', 'DESC'],
    })
    @IsOptional()
    @IsString()
    orderDirection?: 'ASC' | 'DESC' = 'ASC';
} 