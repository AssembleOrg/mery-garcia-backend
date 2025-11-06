import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TipoMoneda } from "src/enums/TipoMoneda.enum";
import { Caja } from "src/enums/Caja.enum";


export class EgresoDto {

  @ApiProperty({
    description: 'Total del egreso',
    example: 100.50,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total: number;
  
  @ApiProperty({
    description: 'Total en dólares del egreso',
    example: 100.50,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalDolar: number;
  
  @ApiProperty({
    description: 'Total en pesos del egreso',
    example: 100.50,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalPesos: number;

  @ApiProperty({
    description: 'Valor en dólares del egreso',
    example: 100.50,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  valorDolar: number;

  @ApiProperty({
    description: 'Moneda del egreso',
    example: 'ARS',
  })
  @IsString()
  @IsEnum(TipoMoneda)
  moneda: string;

  @ApiPropertyOptional({
    description: 'Caja de la que se extrae el egreso',
    enum: Caja,
    example: Caja.CAJA_1,
    default: Caja.CAJA_1,
  })
  @IsOptional()
  @IsEnum(Caja)
  caja?: Caja;
}