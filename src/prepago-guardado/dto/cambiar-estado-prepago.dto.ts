import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPrepago } from '../../enums/EstadoPrepago.enum';

export class CambiarEstadoPrepagoDto {
    @ApiProperty({
        description: 'Nuevo estado del prepago',
        enum: EstadoPrepago,
        example: EstadoPrepago.UTILIZADA,
    })
    @IsEnum(EstadoPrepago)
    estado: EstadoPrepago;

    @ApiPropertyOptional({
        description: 'Observaciones sobre el cambio de estado',
        example: 'Prepago utilizado para pago de comanda #123',
    })
    @IsOptional()
    @IsString()
    observaciones?: string;
} 