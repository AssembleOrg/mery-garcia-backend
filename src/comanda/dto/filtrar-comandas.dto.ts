import { IsOptional, IsEnum, IsDateString, IsString, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';
import { Caja } from 'src/enums/Caja.enum';
import { EstadoComanda } from 'src/comanda/entities/Comanda.entity';

export class FiltrarComandasDto {
  @ApiPropertyOptional({ 
    description: 'Número de comanda para búsqueda exacta',
    example: 'CMD-2024-001' 
  })
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiPropertyOptional({ 
    description: 'Fecha de inicio para filtrar comandas',
    example: '2024-01-01T00:00:00Z' 
  })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ 
    description: 'Fecha de fin para filtrar comandas',
    example: '2024-12-31T23:59:59Z' 
  })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ 
    description: 'Unidad de negocio',
    enum: UnidadNegocio 
  })
  @IsOptional()
  @IsEnum(UnidadNegocio)
  unidadNegocio?: UnidadNegocio;

  @ApiPropertyOptional({ 
    description: 'Caja asignada',
    enum: Caja 
  })
  @IsOptional()
  @IsEnum(Caja)
  enCaja?: Caja;

  @ApiPropertyOptional({ 
    description: 'ID del cliente',
    example: 'uuid-del-cliente' 
  })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ 
    description: 'ID del personal principal',
    example: 'uuid-del-personal' 
  })
  @IsOptional()
  @IsUUID()
  personalPrincipalId?: string;

  @ApiPropertyOptional({ 
    description: 'Estado de la comanda',
    enum: EstadoComanda 
  })
  @IsOptional()
  @IsEnum(EstadoComanda)
  estado?: EstadoComanda;

  @ApiPropertyOptional({ 
    description: 'ID del tipo de comanda',
    example: 'uuid-del-tipo-comanda' 
  })
  @IsOptional()
  @IsUUID()
  tipoId?: string;

  @ApiPropertyOptional({ 
    description: 'ID del tipo de item de comanda',
    example: 'uuid-del-tipo-item'
  })
  @IsOptional()
  @IsUUID()
  tipoItemId?: string;

  @ApiPropertyOptional({ 
    description: 'Monto mínimo para filtrar por total final',
    minimum: 0,
    example: 100 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoMinimo?: number;

  @ApiPropertyOptional({ 
    description: 'Monto máximo para filtrar por total final',
    minimum: 0,
    example: 1000 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montoMaximo?: number;

  @ApiPropertyOptional({ 
    description: 'Término de búsqueda en observaciones',
    example: 'especial' 
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ 
    description: 'Número de página',
    minimum: 1,
    default: 1,
    example: 1 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Cantidad de elementos por página',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Campo para ordenar',
    example: 'fecha',
    enum: ['fecha', 'numero', 'totalFinal', 'estado', 'createdAt'] 
  })
  @IsOptional()
  @IsString()
  orderBy?: string = 'fecha';

  @ApiPropertyOptional({ 
    description: 'Dirección del ordenamiento',
    example: 'DESC',
    enum: ['ASC', 'DESC'] 
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  orderDirection?: 'ASC' | 'DESC' = 'DESC';
} 