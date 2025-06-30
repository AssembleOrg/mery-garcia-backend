import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
  IsPositive,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';
import { Caja } from 'src/enums/Caja.enum';
import { EstadoComanda } from 'src/comanda/entities/Comanda.entity';

export class CrearItemComandaDto {
  @ApiProperty({
    description: 'ID del producto o servicio',
    example: 'uuid-del-producto'
  })
  @IsString()
  productoServicioId: string;

  @ApiProperty({
    description: 'Nombre del producto o servicio',
    example: 'Servicio de consultoría',
    maxLength: 150
  })
  @IsString()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({
    description: 'ID del tipo de item',
    example: 'uuid-del-tipo-item'
  })
  @IsUUID()
  tipoId: string;

  @ApiProperty({
    description: 'Precio unitario',
    example: 100.50,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  precio: number;

  @ApiProperty({
    description: 'Cantidad',
    example: 2,
    minimum: 1
  })
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiPropertyOptional({
    description: 'Descuento aplicado',
    example: 10.00,
    minimum: 0,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number = 0;

  @ApiProperty({
    description: 'ID del personal asignado',
    example: 'uuid-del-personal'
  })
  @IsUUID()
  personalId: string;
}

export class CrearComandaDto {
  @ApiProperty({ 
    description: 'Número de comanda', 
    maxLength: 50,
    example: 'CMD-2024-001' 
  })
  @IsString()
  @MaxLength(50)
  numero: string;

  @ApiProperty({ 
    description: 'Fecha de la comanda',
    example: '2024-01-15T10:30:00Z' 
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({ 
    description: 'Unidad de negocio', 
    enum: UnidadNegocio,
    example: UnidadNegocio.TATTOO 
  })
  @IsEnum(UnidadNegocio)
  unidadNegocio: UnidadNegocio;

  @ApiPropertyOptional({ 
    description: 'Caja asignada', 
    enum: Caja,
    default: Caja.CAJA_1,
    example: Caja.CAJA_1 
  })
  @IsOptional()
  @IsEnum(Caja)
  enCaja?: Caja;

  @ApiProperty({ 
    description: 'ID del cliente',
    example: 'uuid-del-cliente' 
  })
  @IsUUID()
  clienteId: string;

  @ApiProperty({ 
    description: 'ID del personal principal',
    example: 'uuid-del-personal-principal' 
  })
  @IsUUID()
  personalPrincipalId: string;

  @ApiProperty({ 
    description: 'Items de la comanda',
    type: [CrearItemComandaDto] 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearItemComandaDto)
  items: CrearItemComandaDto[];

  @ApiPropertyOptional({ 
    description: 'IDs de métodos de pago',
    type: [String],
    example: ['uuid-metodo-1', 'uuid-metodo-2'] 
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  metodosPagoIds?: string[];

  @ApiPropertyOptional({ 
    description: 'ID del prepago asociado',
    example: 'uuid-del-prepago' 
  })
  @IsOptional()
  @IsUUID()
  prepagoId?: string;

  @ApiPropertyOptional({ 
    description: 'Subtotal',
    minimum: 0,
    example: 1000.00 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ 
    description: 'Total de descuentos',
    minimum: 0,
    example: 100.00 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDescuentos?: number;

  @ApiPropertyOptional({ 
    description: 'Total de recargos',
    minimum: 0,
    example: 50.00 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalRecargos?: number;

  @ApiPropertyOptional({ 
    description: 'Total prepago',
    minimum: 0,
    example: 200.00 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrepago?: number;

  @ApiPropertyOptional({ 
    description: 'Total final',
    minimum: 0,
    example: 950.00 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalFinal?: number;

  @ApiPropertyOptional({ 
    description: 'Estado de la comanda', 
    enum: EstadoComanda,
    default: EstadoComanda.PENDIENTE,
    example: EstadoComanda.PENDIENTE 
  })
  @IsOptional()
  @IsEnum(EstadoComanda)
  estado?: EstadoComanda;

  @ApiProperty({
    description: 'ID del tipo de comanda',
    example: 'uuid-del-tipo-comanda'
  })
  @IsUUID()
  tipoId: string;

  @ApiPropertyOptional({ 
    description: 'Observaciones',
    maxLength: 500,
    example: 'Cliente solicita atención especial' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
} 