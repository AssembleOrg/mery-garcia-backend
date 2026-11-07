import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EstadoPedidoCompra,
  MonedaCompra,
} from '../entities/PedidoCompra.entity';

const vacioANull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

// ─── Proveedores ───────────────────────────────────────────────

export class ProveedorCompraDto {
  @ApiProperty({ example: 'Oui Classy SRL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({ example: '30-71809162-0' })
  @IsOptional()
  @Transform(vacioANull)
  @IsString()
  @MaxLength(40)
  documento?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(vacioANull)
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(vacioANull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  @MaxLength(120)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(vacioANull)
  @IsString()
  @MaxLength(2000)
  notas?: string | null;
}

// ─── Categorías ────────────────────────────────────────────────

export class CategoriaCompraDto {
  @ApiProperty({ example: 'Descartables' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  orden?: number;
}

// ─── Pedidos ───────────────────────────────────────────────────

export class ItemPedidoCompraDto {
  @ApiPropertyOptional({ description: 'Artículo del catálogo de stock' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  productoId?: string | null;

  @ApiProperty({ example: 'Hisopos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(100000)
  cantidad: number;

  @ApiPropertyOptional({ description: 'Lo que llegó (sólo si ya se entregó)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(100000)
  cantidadRecibida?: number | null;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1e12)
  precioUnitario?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  afectaStock?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  categoriaIds?: string[];
}

export class GuardarPedidoCompraDto {
  @ApiPropertyOptional({ example: 'Reposición descartables' })
  @IsOptional()
  @Transform(vacioANull)
  @IsString()
  @MaxLength(150)
  titulo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(vacioANull)
  @IsString()
  @MaxLength(4000)
  nota?: string | null;

  @ApiPropertyOptional({ enum: EstadoPedidoCompra })
  @IsOptional()
  @IsEnum(EstadoPedidoCompra)
  estado?: EstadoPedidoCompra;

  @ApiPropertyOptional({ enum: MonedaCompra })
  @IsOptional()
  @IsEnum(MonedaCompra)
  moneda?: MonedaCompra;

  @ApiPropertyOptional({
    description: 'Total a mano; null = suma de renglones',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1e12)
  total?: number | null;

  @ApiPropertyOptional({ example: 'Transferencia' })
  @IsOptional()
  @Transform(vacioANull)
  @IsString()
  @MaxLength(40)
  medioPago?: string | null;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  proveedorIds: string[];

  @ApiProperty({ type: [ItemPedidoCompraDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoCompraDto)
  items: ItemPedidoCompraDto[];

  @ApiPropertyOptional({
    description: 'Versión que se editó (evita pisar cambios)',
  })
  @IsOptional()
  @IsInt()
  version?: number;
}

export class CambiarEstadoPedidoDto {
  @ApiProperty({ enum: EstadoPedidoCompra })
  @IsEnum(EstadoPedidoCompra)
  estado: EstadoPedidoCompra;
}

export class RecibidoItemDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100000)
  cantidadRecibida: number;
}

export class EntregarPedidoDto {
  @ApiPropertyOptional({
    type: [RecibidoItemDto],
    description: 'Sólo los renglones que no llegaron completos',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RecibidoItemDto)
  recibidos?: RecibidoItemDto[];
}

export const FILTROS_ESTADO = [
  ...Object.values(EstadoPedidoCompra),
  'ABIERTOS',
] as const;

export class FiltroPedidosCompraDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  @ApiPropertyOptional({ enum: FILTROS_ESTADO })
  @IsOptional()
  @IsIn(FILTROS_ESTADO)
  estado?: (typeof FILTROS_ESTADO)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
