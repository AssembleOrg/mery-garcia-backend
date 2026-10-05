import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class CrearLoteDto {
  @ApiProperty({
    example: '2026-08-18',
    description: 'Día de las comandas (AAAA-MM-DD)',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser AAAA-MM-DD' })
  fecha: string;
}
