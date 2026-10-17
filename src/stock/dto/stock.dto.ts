import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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
  @ApiProperty({ description: 'Reemplaza los productos asignados al trabajador', type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  productoIds: string[];
}
