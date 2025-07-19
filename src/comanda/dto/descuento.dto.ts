// descuento.dto.ts
import { IsString, IsNumber, Min } from 'class-validator';

export class DescuentoDto {
  @IsString() nombre!: string;
  @IsString() descripcion!: string;
  @IsNumber() @Min(0) porcentaje!: number;
  @IsNumber() @Min(0) montoFijo!: number;
}
