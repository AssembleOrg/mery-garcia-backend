import { IsEnum, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Caja } from 'src/enums/Caja.enum';

export class TransferirCajaDto {
  @ApiProperty({
    description: 'Caja de origen',
    enum: Caja,
    example: Caja.CAJA_1,
  })
  @IsEnum(Caja)
  @IsNotEmpty()
  cajaOrigen: Caja;

  @ApiProperty({
    description: 'Caja de destino',
    enum: Caja,
    example: Caja.CAJA_2,
  })
  @IsEnum(Caja)
  @IsNotEmpty()
  cajaDestino: Caja;

  @ApiProperty({
    description: 'Monto a transferir',
    example: 15000.50,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  monto: number;

  @ApiProperty({
    description: 'Observaciones de la transferencia',
    example: 'Transferencia de cierre de día',
    required: false,
  })
  observaciones?: string;
} 