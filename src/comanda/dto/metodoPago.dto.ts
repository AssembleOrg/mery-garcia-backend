// metodo-pago.dto.ts
import { IsEnum, IsNumber, Min } from 'class-validator';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { TipoPago } from 'src/enums/TipoPago.enum';

export class MetodoPagoDto {
  @IsEnum(TipoPago) tipo!: TipoPago;
  @IsNumber() @Min(0) monto!: number;
  @IsNumber() @Min(0) montoFinal!: number;
  @IsNumber() @Min(0) descuentoGlobalPorcentaje!: number;
  @IsEnum(TipoMoneda) moneda!: TipoMoneda;
  @IsNumber() @Min(0) recargoPorcentaje!: number;
}
