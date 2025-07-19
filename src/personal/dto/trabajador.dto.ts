import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsNumber, 
  IsBoolean, 
  IsOptional, 
  MaxLength, 
  Min, 
  Max,
  IsNotEmpty, 
  IsArray,
  IsUUID
} from 'class-validator';
import { RolTrabajador } from 'src/enums/RolTrabajador.enum';

export class CrearTrabajadorDto {
  @ApiProperty({
    description: 'Nombre completo del trabajador',
    example: 'Juan Pérez',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Rol del trabajador en la organización',
    enum: RolTrabajador,
    example: RolTrabajador.TRABAJADOR,
    default: RolTrabajador.TRABAJADOR
  })
  @IsOptional()
  @IsEnum(RolTrabajador)
  rol?: RolTrabajador;

  @ApiPropertyOptional({
    description: 'Teléfono del trabajador',
    example: '1234567890',
    maxLength: 20
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({
    description: 'Porcentaje de comisión del trabajador (0-100)',
    example: 15.50,
    minimum: 0,
    maximum: 100,
    default: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  comisionPorcentaje?: number;

  @ApiPropertyOptional({
    description: 'Estado activo del trabajador',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarTrabajadorDto extends PartialType(CrearTrabajadorDto) {

}

export class FiltrarTrabajadoresDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre (búsqueda parcial)',
    example: 'Juan'
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por rol',
    enum: RolTrabajador
  })
  @IsOptional()
  @IsEnum(RolTrabajador)
  rol?: RolTrabajador;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Elementos por página',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    example: 'nombre',
    enum: ['nombre', 'rol', 'comisionPorcentaje', 'createdAt'],
    default: 'nombre'
  })
  @IsOptional()
  @IsString()
  orderBy?: 'nombre' | 'rol' | 'comisionPorcentaje' | 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
    default: 'ASC'
  })
  @IsOptional()
  @IsString()
  orderDirection?: 'ASC' | 'DESC';
}
