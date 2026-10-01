import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { TipoMoneda } from '../../enums/TipoMoneda.enum';
import { TipoAcreedor } from '../entities/acreedor.entity';

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export class CrearAcreedorDto {
  @ApiProperty({ example: 'Distribuidora Belleza SRL', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ enum: TipoAcreedor })
  @IsEnum(TipoAcreedor)
  tipo: TipoAcreedor;

  @ApiPropertyOptional({ example: '30-71234567-8' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  documento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.email !== '')
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;
}

export class ActualizarAcreedorDto extends PartialType(CrearAcreedorDto) {}

export class CrearDeudaDto {
  @ApiProperty()
  @IsUUID()
  acreedorId: string;

  @ApiProperty({ example: 'Compra de insumos septiembre', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  concepto: string;

  @ApiProperty({ enum: TipoMoneda })
  @IsEnum(TipoMoneda)
  moneda: TipoMoneda;

  @ApiProperty({ example: 150000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999_999)
  monto: number;

  @ApiPropertyOptional({
    example: '2026-09-28',
    description: 'Por defecto, hoy',
  })
  @IsOptional()
  @Matches(DIA, { message: 'fecha debe ser AAAA-MM-DD' })
  fecha?: string;

  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @ValidateIf((o) => o.vencimiento !== null)
  @Matches(DIA, { message: 'vencimiento debe ser AAAA-MM-DD' })
  vencimiento?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;

  @ApiPropertyOptional({
    description:
      'Descontar al toque el saldo a favor (adelantos) del acreedor en esa moneda',
  })
  @IsOptional()
  @IsBoolean()
  aplicarAdelantos?: boolean;
}

export class ActualizarDeudaDto extends PartialType(
  OmitType(CrearDeudaDto, ['aplicarAdelantos'] as const),
) {}

export class CrearAdelantoDto {
  @ApiProperty()
  @IsUUID()
  acreedorId: string;

  @ApiProperty({ example: 'Comisiones octubre', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  concepto: string;

  @ApiProperty({ enum: TipoMoneda })
  @IsEnum(TipoMoneda)
  moneda: TipoMoneda;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999_999)
  monto: number;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Por defecto, hoy',
  })
  @IsOptional()
  @Matches(DIA, { message: 'fecha debe ser AAAA-MM-DD' })
  fecha?: string;

  @ApiPropertyOptional({
    example: '2026-10-10',
    description: 'Cuándo se espera liquidar (orientativo)',
  })
  @IsOptional()
  @ValidateIf((o) => o.fechaEstimada !== null)
  @Matches(DIA, { message: 'fechaEstimada debe ser AAAA-MM-DD' })
  fechaEstimada?: string | null;

  @ApiPropertyOptional({ example: 'Efectivo' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  metodo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nota?: string;
}

export class ActualizarAdelantoDto extends PartialType(CrearAdelantoDto) {}

export class AplicarAdelantosDto {
  @ApiPropertyOptional({
    description: 'Cuánto descontar; por defecto, todo lo posible',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;
}

export class FiltroAdelantosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  acreedorId?: string;

  @ApiPropertyOptional({ enum: ['disponibles', 'todos'] })
  @IsOptional()
  @IsIn(['disponibles', 'todos'])
  estado?: 'disponibles' | 'todos';
}

export class CrearPagoDto {
  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999_999)
  monto: number;

  @ApiPropertyOptional({
    example: '2026-09-28',
    description: 'Por defecto, hoy',
  })
  @IsOptional()
  @Matches(DIA, { message: 'fecha debe ser AAAA-MM-DD' })
  fecha?: string;

  @ApiPropertyOptional({ example: 'Transferencia' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  metodo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nota?: string;
}

export class ActualizarPagoDto extends PartialType(CrearPagoDto) {}

export class FiltroDeudasDto {
  @ApiPropertyOptional({ enum: ['abiertas', 'saldadas', 'vencidas', 'todas'] })
  @IsOptional()
  @IsIn(['abiertas', 'saldadas', 'vencidas', 'todas'])
  estado?: 'abiertas' | 'saldadas' | 'vencidas' | 'todas';

  @ApiPropertyOptional({ enum: TipoMoneda })
  @IsOptional()
  @IsEnum(TipoMoneda)
  moneda?: TipoMoneda;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  acreedorId?: string;
}

export class FiltroHistorialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  acreedorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deudaId?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}
