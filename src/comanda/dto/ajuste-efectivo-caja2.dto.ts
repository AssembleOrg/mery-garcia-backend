import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CrearAjusteEfectivoCaja2Dto {
  @ApiProperty({
    description: 'Monto en ARS a ajustar. Positivo para agregar, negativo para restar.',
    example: 5000,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  montoARS: number;

  @ApiProperty({
    description: 'Monto en USD a ajustar. Positivo para agregar, negativo para restar.',
    example: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  montoUSD: number;

  @ApiPropertyOptional({
    description: 'Observaciones sobre el ajuste',
    example: 'Ingreso de efectivo por venta externa',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
