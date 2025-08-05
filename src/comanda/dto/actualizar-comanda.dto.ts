import { PartialType, OmitType } from '@nestjs/swagger';
import { CrearComandaDto } from './crear-comanda.dto';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ActualizarComandaDto extends PartialType(
  OmitType(CrearComandaDto, ['numero'] as const)
) {
  @ApiPropertyOptional({
    description: 'Número de comanda (opcional en actualización)',
    example: 'COM-2024-001',
  })
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional({
    description: 'ID del cliente (opcional en actualización)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({
    description: 'ID del personal que crea la comanda (opcional en actualización)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  creadoPorId?: string;
} 