import { IsOptional, IsString, IsNumber, Min, Max, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoMoneda } from '../../enums/TipoMoneda.enum';
import { EstadoPrepago } from '../../enums/EstadoPrepago.enum';

export class FiltrarPrepagosGuardadosDto {
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
        description: 'Término de búsqueda para observaciones',
        example: 'tatuaje',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Moneda del prepago',
        enum: TipoMoneda,
    })
    @IsOptional()
    @IsEnum(TipoMoneda)
    moneda?: TipoMoneda;

    @ApiPropertyOptional({
        description: 'Estado del prepago',
        enum: EstadoPrepago,
    })
    @IsOptional()
    @IsEnum(EstadoPrepago)
    estado?: EstadoPrepago;

    @ApiPropertyOptional({
        description: 'ID del cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsOptional()
    @IsUUID()
    clienteId?: string;

    @ApiPropertyOptional({
        description: 'Ordenar por campo',
        example: 'fechaCreacion',
        enum: ['fechaCreacion', 'monto', 'estado'],
    })
    @IsOptional()
    @IsString()
    orderBy?: string = 'fechaCreacion';

    @ApiPropertyOptional({
        description: 'Orden de clasificación',
        example: 'DESC',
        enum: ['ASC', 'DESC'],
    })
    @IsOptional()
    @IsString()
    order?: 'ASC' | 'DESC' = 'DESC';
} 