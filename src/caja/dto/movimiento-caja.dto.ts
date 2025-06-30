import { IsEnum, IsNumber, IsString, IsOptional, MinLength } from 'class-validator';
import { Caja } from 'src/enums/Caja.enum';
import { TipoMovimiento } from 'src/enums/TipoMovimiento.enum';

export class CrearMovimientoCajaDto {
  @IsEnum(Caja)
  caja: Caja;

  @IsEnum(TipoMovimiento)
  tipoMovimiento: TipoMovimiento;

  @IsNumber()
  monto: number;

  @IsString()
  @MinLength(10, { message: 'Las observaciones deben tener al menos 10 caracteres' })
  observaciones: string;

  @IsOptional()
  @IsString()
  referencia?: string;
} 
