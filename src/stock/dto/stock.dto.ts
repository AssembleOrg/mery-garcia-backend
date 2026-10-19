import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EstadoSolicitudStock } from '../entities/SolicitudStock.entity';

export class CrearProductosStockDto {
  @ApiProperty({ example: ['Tintura 7.1', 'Guantes de nitrilo'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(150, { each: true })
  nombres: string[];
}

export class ActualizarProductoStockDto {
  @ApiProperty({ example: 'Tintura 7.1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;
}

export class AsignarProductosDto {
  @ApiProperty({
    description: 'Reemplaza los productos asignados al trabajador',
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  productoIds: string[];
}

export class ItemSolicitudDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, default: 1, minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  cantidad?: number;
}

export class CrearSolicitudStockDto {
  @ApiProperty({ type: [ItemSolicitudDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitudDto)
  items: ItemSolicitudDto[];

  @ApiProperty({ required: false, example: 'Alisado de Carla, 15 h' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

export class ResolverSolicitudStockDto {
  @ApiProperty({
    required: false,
    description: 'Comentario o motivo del rechazo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  respuesta?: string;
}

export class FiltroSolicitudesStockDto {
  @ApiProperty({ required: false, enum: EstadoSolicitudStock })
  @IsOptional()
  @IsEnum(EstadoSolicitudStock)
  estado?: EstadoSolicitudStock;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  trabajadorId?: string;
}

export class GuardarAccesoEmpleadoDto {
  @ApiProperty({
    example: 'lucia',
    description: 'Con esto entra (no hace falta email)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9._@-]+$/i, {
    message: 'Usuario: sólo letras, números, punto, guion o @',
  })
  usuario: string;

  @ApiProperty({
    required: false,
    description: 'Obligatoria al crear; al editar, sólo si se cambia',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password?: string;
}
