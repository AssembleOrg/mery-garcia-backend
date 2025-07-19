import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsString, Min } from "class-validator";
import { TipoMoneda } from "src/enums/TipoMoneda.enum";


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
}