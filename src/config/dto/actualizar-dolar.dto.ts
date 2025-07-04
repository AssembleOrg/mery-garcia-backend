import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class ActualizarDolarDto {
  @ApiProperty({
    description: 'Precio de compra del dólar blue',
    example: 1190,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @Max(10000)
  compra: number;

  @ApiProperty({
    description: 'Precio de venta del dólar blue',
    example: 1210,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @Max(10000)
  @IsOptional()
  venta: number;

  @ApiProperty({
    description: 'Casa de cambio',
    example: 'Manual',
    required: false,
  })
  @IsString()
  @IsOptional()
  casa?: string;

  @ApiProperty({
    description: 'Nombre de la cotización',
    example: 'Blue Manual',
    required: false,
  })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiProperty({
    description: 'Tipo de moneda',
    example: 'USD',
    required: false,
  })
  @IsString()
  @IsOptional()
  moneda?: string;
} 