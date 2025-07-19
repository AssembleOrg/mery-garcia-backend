import { IsString, IsOptional, IsNumber, IsUUID, IsEnum, IsArray, Min, IsBoolean, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TipoDeComanda, EstadoDeComanda, Caja } from '../entities/Comanda.entity';
import { Type } from 'class-transformer';
import { CrearItemComandaDto } from './item-comanda.dto';
import { DescuentoDto } from './descuento.dto';
import { MetodoPagoDto } from './metodoPago.dto';
import { EgresoDto } from './egreso.dto';

export class CrearEgresoDto {
    @ApiProperty({
      description: 'Número de comanda',
      example: 'COM-2024-001',
    })
    @IsString()
    numero: string;
  
    @ApiProperty({
      description: 'Caja de la comanda',
      enum: Caja,
      example: Caja.CAJA_1,
    })
    @IsEnum(Caja)
    caja: Caja;
  
    @ApiProperty({
      description: 'Tipo de comanda',
      enum: TipoDeComanda,
      example: TipoDeComanda.INGRESO,
    })
    @IsEnum(TipoDeComanda)
    tipoDeComanda: TipoDeComanda;
  
    @ApiProperty({
      description: 'Estado de la comanda',
      enum: EstadoDeComanda,
      example: EstadoDeComanda.PENDIENTE,
    })
    @IsEnum(EstadoDeComanda)
    estadoDeComanda: EstadoDeComanda;
  
    @ApiProperty({
      description: 'ID del personal que crea la comanda',
      example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    creadoPorId: string;
  
    @ApiProperty({
      description: 'Precio en dólares',
      example: 100.50,
      minimum: 0,
    })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    precioDolar: number;

    @ApiProperty({
      description: 'Egresos',
      example: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        cantidad: 1,
      }],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EgresoDto)
    @IsOptional()
    egresos?: EgresoDto[];
  
    @ApiProperty({
      description: 'Precio en pesos',
      example: 1000.50,
      minimum: 0,
    })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    precioPesos: number;
  
    @ApiProperty({
      description: 'Valor del dólar',
      example: 1000.00,
      minimum: 0,
    })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    valorDolar: number;
  
    @ApiPropertyOptional({
      description: 'Observaciones de la comanda',
      example: 'Comanda para tatuaje de manga',
    })
    @IsOptional()
    @IsString()
    observaciones?: string;
  
    @ApiProperty({
      description: 'Items de la comanda',
      example: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        cantidad: 1,
      }],
    })
    @ValidateNested({ each: true })
    @Type(() => CrearItemComandaDto)
    @IsArray()
    @IsOptional()
    items?: CrearItemComandaDto[];
  } 