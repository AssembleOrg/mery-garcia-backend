import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, Min, MaxLength } from 'class-validator';

export class CrearTipoItemDto {
  @ApiProperty({
    description: 'Nombre del tipo de item',
    example: 'Producto',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción del tipo de item',
    example: 'Productos físicos',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Orden de visualización',
    example: 1,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({
    description: 'Si el tipo está activo',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarTipoItemDto {
  @ApiPropertyOptional({
    description: 'Nombre del tipo de item',
    example: 'Producto',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Descripción del tipo de item',
    example: 'Productos físicos',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Orden de visualización',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({
    description: 'Si el tipo está activo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
} 