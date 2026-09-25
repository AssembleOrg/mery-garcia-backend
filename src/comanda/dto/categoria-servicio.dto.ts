import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearCategoriaServicioDto {
  @ApiProperty({ description: 'Nombre de la categoría', example: 'Categoría A', maxLength: 60 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción', example: 'Laminado, modelado y refill' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Orden en que se muestra', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({
    description: 'Servicios que pertenecen a la categoría (reemplaza la lista actual)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  servicioIds?: string[];
}

export class ActualizarCategoriaServicioDto extends PartialType(CrearCategoriaServicioDto) {}
