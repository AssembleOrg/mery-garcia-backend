// metodo-pago.dto.ts
import { IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { TipoPago } from 'src/enums/TipoPago.enum';

export class MetodoPagoDto {
  @ApiProperty({
    description: 'Tipo de método de pago',
    enum: TipoPago,
    example: TipoPago.EFECTIVO,
  })
  @IsEnum(TipoPago) 
  tipo!: TipoPago;

  @ApiProperty({
    description: 'Monto del pago',
    example: 100.50,
    minimum: 0,
  })
  @IsNumber() 
  @Min(0) 
  monto!: number;

  @ApiProperty({
    description: 'Monto final después de descuentos',
    example: 95.50,
    minimum: 0,
  })
  @IsNumber() 
  @Min(0) 
  montoFinal!: number;

  @ApiProperty({
    description: 'Porcentaje de descuento global',
    example: 5.0,
    minimum: 0,
  })
  @IsNumber() 
  @Min(0) 
  descuentoGlobalPorcentaje!: number;

  @ApiProperty({
    description: 'Moneda del pago',
    enum: TipoMoneda,
    example: TipoMoneda.ARS,
  })
  @IsEnum(TipoMoneda) 
  moneda!: TipoMoneda;

  @ApiProperty({
    description: 'Porcentaje de recargo',
    example: 0.0,
    minimum: 0,
  })
  @IsNumber() 
  @Min(0) 
  recargoPorcentaje!: number;
}
