import { IsString, IsOptional, IsNumber, IsUUID, IsEnum, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoMoneda } from '../../enums/TipoMoneda.enum';
import { EstadoPrepago } from '../../enums/EstadoPrepago.enum';

export class CrearPrepagoGuardadoDto {
    @ApiProperty({
        description: 'Monto del prepago',
        example: 1000.50,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    monto: number;

    @ApiProperty({
        description: 'Moneda del prepago',
        enum: TipoMoneda,
        example: TipoMoneda.ARS,
    })
    @IsEnum(TipoMoneda)
    moneda: TipoMoneda;

    @ApiPropertyOptional({
        description: 'Fecha de vencimiento del prepago',
        example: '2024-12-31T23:59:59.000Z',
    })
    @IsOptional()
    @IsDateString()
    fechaVencimiento?: string;

    @ApiProperty({
        description: 'Estado del prepago',
        enum: EstadoPrepago,
        example: EstadoPrepago.ACTIVA,
    })
    @IsEnum(EstadoPrepago)
    estado: EstadoPrepago;

    @ApiPropertyOptional({
        description: 'Observaciones del prepago',
        example: 'Prepago por servicios de tatuaje',
        default: '',
    })
    @IsOptional()
    @IsString()
    observaciones?: string;

    @ApiProperty({
        description: 'ID del cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    clienteId: string;
} 