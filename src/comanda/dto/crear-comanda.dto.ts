import { IsString, IsOptional, IsNumber, IsUUID, IsEnum, IsArray, Min, IsBoolean, ValidateNested, IsDate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TipoDeComanda, EstadoDeComanda, Caja } from '../entities/Comanda.entity';
import { Type } from 'class-transformer';
import { CrearItemComandaDto } from './item-comanda.dto';
import { DescuentoDto } from './descuento.dto';

export class CrearComandaDto {
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
    description: 'Fecha de creación de la comanda',
    example: '2024-01-01',
  })
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({
    description: 'Estado de la comanda',
    enum: EstadoDeComanda,
    example: EstadoDeComanda.PENDIENTE,
  })
  @IsEnum(EstadoDeComanda)
  estadoDeComanda: EstadoDeComanda;

  @ApiPropertyOptional({
    description: 'ID del cliente',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

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
  precioDolar: number;

  @ApiProperty({
    description: 'Precio en pesos',
    example: 1000.50,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precioPesos: number;

  @ApiProperty({
    description: 'Valor del dólar',
    example: 1000.00,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  valorDolar: number;

  @ApiPropertyOptional({
    description: 'Observaciones de la comanda',
    example: 'Comanda para tatuaje de manga',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({
    description: 'Usuario consume prepago ARS',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  usuarioConsumePrepagoARS: boolean;

  @ApiProperty({
    description: 'Usuario consume prepago USD',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  usuarioConsumePrepagoUSD: boolean;

  @ApiProperty({
    description: 'Descuentos aplicados',
    example: [{
      id: '123e4567-e89b-12d3-a456-426614174000',
      descuento: 10,
    }],
  })
  @Type(() => DescuentoDto)
  @ValidateNested({ each: true })
  @IsArray()
  descuentosAplicados?: DescuentoDto[];

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