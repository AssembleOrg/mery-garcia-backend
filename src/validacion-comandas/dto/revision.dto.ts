import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RevisionPagina } from '../entities/paginaValidacion.entity';

export class RevisionDto {
  @ApiProperty({ enum: RevisionPagina })
  @IsEnum(RevisionPagina)
  decision: RevisionPagina;

  @ApiPropertyOptional({ description: 'Obligatoria si se marca error' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}
