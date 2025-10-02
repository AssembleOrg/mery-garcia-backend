import { ApiProperty } from '@nestjs/swagger';
import { TipoPago } from 'src/enums/TipoPago.enum';

export class MontosPorMonedaDto {
  @ApiProperty({
    description: 'Monto en pesos argentinos',
    example: 15000.50,
  })
  ARS: number;

  @ApiProperty({
    description: 'Monto en dólares estadounidenses',
    example: 1500.25,
  })
  USD: number;
}

export class PorMetodoPagoDto {
  @ApiProperty({
    description: 'Montos para pagos en efectivo',
    type: MontosPorMonedaDto,
  })
  [TipoPago.EFECTIVO]: MontosPorMonedaDto;

  @ApiProperty({
    description: 'Montos para pagos con tarjeta',
    type: MontosPorMonedaDto,
  })
  [TipoPago.TARJETA]: MontosPorMonedaDto;

  @ApiProperty({
    description: 'Montos para pagos por transferencia',
    type: MontosPorMonedaDto,
  })
  [TipoPago.TRANSFERENCIA]: MontosPorMonedaDto;

  @ApiProperty({
    description: 'Montos para pagos con cheque',
    type: MontosPorMonedaDto,
  })
  [TipoPago.CHEQUE]: MontosPorMonedaDto;

  @ApiProperty({
    description: 'Montos para pagos por QR',
    type: MontosPorMonedaDto,
  })
  [TipoPago.QR]: MontosPorMonedaDto;

  @ApiProperty({
    description: 'Montos para pagos con gift card',
    type: MontosPorMonedaDto,
  })
  [TipoPago.GIFT_CARD]: MontosPorMonedaDto;
}

export class ResumenCajaPorMetodoPagoDto {
  @ApiProperty({
    description: 'Total de comandas completadas (validadas)',
    example: 25,
  })
  totalCompletados: number;

  @ApiProperty({
    description: 'Total de comandas pendientes',
    example: 5,
  })
  totalPendientes: number;

  @ApiProperty({
    description: 'Monto neto en dólares (ingresos - egresos)',
    example: 1500.75,
  })
  montoNetoUSD: number;

  @ApiProperty({
    description: 'Monto neto en pesos (ingresos - egresos)',
    example: 15000.50,
  })
  montoNetoARS: number;

  @ApiProperty({
    description: 'Monto disponible para traslado en dólares',
    example: 1500.75,
  })
  montoDisponibleTrasladoUSD: number;

  @ApiProperty({
    description: 'Monto disponible para traslado en pesos',
    example: 15000.50,
  })
  montoDisponibleTrasladoARS: number;

  @ApiProperty({
    description: 'Total de ingresos en dólares',
    example: 2000.00,
  })
  totalIngresosUSD: number;

  @ApiProperty({
    description: 'Total de ingresos en pesos',
    example: 20000.00,
  })
  totalIngresosARS: number;

  @ApiProperty({
    description: 'Total de egresos en dólares',
    example: 500.25,
  })
  totalEgresosUSD: number;

  @ApiProperty({
    description: 'Total de egresos en pesos',
    example: 5000.50,
  })
  totalEgresosARS: number;

  @ApiProperty({
    description: 'IDs de las comandas validadas incluidas en el resumen',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    type: [String],
  })
  comandasValidadasIds: string[];

  @ApiProperty({
    description: 'Desglose de montos por método de pago y moneda',
    type: PorMetodoPagoDto,
  })
  porMetodoPago: PorMetodoPagoDto;
}

