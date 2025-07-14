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
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';
import { Caja } from 'src/enums/Caja.enum';
import { EstadoComanda } from 'src/comanda/entities/Comanda.entity';

export class ActualizarItemComandaDto {
  @ApiPropertyOptional({ description: 'ID del item (para actualizar existente)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'ID del producto o servicio' })
  @IsOptional()
  @IsString()
  productoServicioId?: string;

  @ApiPropertyOptional({ description: 'Nombre del producto o servicio', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ 
    description: 'ID del tipo de item',
    example: 'uuid-del-tipo-item'
  })
  @IsOptional()
  @IsUUID()
  tipoId?: string;

  @ApiPropertyOptional({ 
    description: 'Precio unitario', 
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precio?: number;

  @ApiPropertyOptional({ 
    description: 'Cantidad', 
    minimum: 1
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cantidad?: number;

  @ApiPropertyOptional({ 
    description: 'Descuento aplicado', 
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiPropertyOptional({ 
    description: 'ID del personal que realiza el trabajo'
  })
  @IsOptional()
  @IsUUID()
  personalId?: string;
}

export class ActualizarComandaDto {
  @ApiPropertyOptional({ 
    description: 'Número de comanda', 
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numero?: string;

  @ApiPropertyOptional({ 
    description: 'Fecha de la comanda'
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional({ 
    description: 'Unidad de negocio', 
    enum: UnidadNegocio
  })
  @IsOptional()
  @IsEnum(UnidadNegocio)
  unidadNegocio?: UnidadNegocio;

  @ApiPropertyOptional({ 
    description: 'Caja asignada', 
    enum: Caja
  })
  @IsOptional()
  @IsEnum(Caja)
  enCaja?: Caja;

  @ApiPropertyOptional({ 
    description: 'ID del cliente'
  })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ 
    description: 'ID del personal principal'
  })
  @IsOptional()
  @IsUUID()
  personalPrincipalId?: string;

  @ApiPropertyOptional({ 
    description: 'Items de la comanda',
    type: [ActualizarItemComandaDto] 
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActualizarItemComandaDto)
  items?: ActualizarItemComandaDto[];

  @ApiPropertyOptional({ 
    description: 'IDs de métodos de pago',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  metodosPagoIds?: string[];

  @ApiPropertyOptional({ 
    description: 'ID del prepago asociado'
  })
  @IsOptional()
  @IsUUID()
  prepagoId?: string;

  @ApiPropertyOptional({ 
    description: 'Subtotal',
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ 
    description: 'Total de descuentos',
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDescuentos?: number;

  @ApiPropertyOptional({ 
    description: 'Total de recargos',
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalRecargos?: number;

  @ApiPropertyOptional({ 
    description: 'Total prepago',
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrepago?: number;

  @ApiPropertyOptional({ 
    description: 'Total final',
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalFinal?: number;

  @ApiPropertyOptional({ 
    description: 'Estado de la comanda', 
    enum: EstadoComanda
  })
  @IsOptional()
  @IsEnum(EstadoComanda)
  estado?: EstadoComanda;

  @ApiPropertyOptional({
    description: 'ID del tipo de comanda',
    example: 'uuid-del-tipo-comanda'
  })
  @IsOptional()
  @IsUUID()
  tipoId?: string;

  @ApiPropertyOptional({ 
    description: 'Observaciones',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @ApiPropertyOptional({ 
    description: 'Precio en dólares',
    minimum: 0,
    example: 100.00 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioDolar?: number;
} 