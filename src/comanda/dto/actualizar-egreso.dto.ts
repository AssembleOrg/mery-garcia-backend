import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TipoMoneda } from "src/enums/TipoMoneda.enum";
import { Caja } from "src/enums/Caja.enum";

export class ActualizarEgresoDto {
  @ApiPropertyOptional({
    description: 'Total del egreso',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiPropertyOptional({
    description: 'Total en dólares',
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalDolar?: number;

  @ApiPropertyOptional({
    description: 'Total en pesos',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalPesos?: number;

  @ApiPropertyOptional({
    description: 'Valor del dólar al momento del egreso',
    example: 1440,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorDolar?: number;

  @ApiPropertyOptional({
    description: 'Moneda del egreso',
    enum: TipoMoneda,
    example: TipoMoneda.ARS,
  })
  @IsOptional()
  @IsEnum(TipoMoneda)
  moneda?: string;

  @ApiPropertyOptional({
    description: 'Caja del egreso (no se puede cambiar si ya está en CAJA_2 traspasada)',
    enum: Caja,
    example: Caja.CAJA_1,
  })
  @IsOptional()
  @IsEnum(Caja)
  caja?: Caja;
}

