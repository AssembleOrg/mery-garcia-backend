import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ProductoStock } from '../../stock/entities/ProductoStock.entity';
import { CategoriaCompra } from './CategoriaCompra.entity';
import { ProveedorCompra } from './ProveedorCompra.entity';

/**
 * Por dónde va un pedido de compra:
 * ANOTADO (un deseo o una nota, sin precio) → PEDIR_PRECIO (a cotizar para
 * Melián) → COMPRADO → ENTREGADO (recién ahí suma al stock). CANCELADO desde
 * cualquier punto.
 */
export enum EstadoPedidoCompra {
  ANOTADO = 'ANOTADO',
  PEDIR_PRECIO = 'PEDIR_PRECIO',
  COMPRADO = 'COMPRADO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

export enum MonedaCompra {
  ARS = 'ARS',
  USD = 'USD',
}

@Entity({ name: 'compras_pedidos' })
@Index('ix_compras_pedidos_estado_fecha', ['estado', 'createdAt'])
export class PedidoCompra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número para nombrarlo ("pedido 12"). */
  @Index('ux_compras_pedidos_numero', { unique: true })
  @Column({ type: 'int' })
  @Generated('increment')
  numero: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  titulo: string | null;

  @Column({ type: 'text', nullable: true })
  nota: string | null;

  @Column({ type: 'varchar', length: 15, default: EstadoPedidoCompra.ANOTADO })
  estado: EstadoPedidoCompra;

  @Column({ type: 'varchar', length: 3, default: MonedaCompra.ARS })
  moneda: MonedaCompra;

  /** Total cargado a mano. Si falta, vale la suma de los renglones con precio. */
  @Column({ type: 'numeric', precision: 20, scale: 2, nullable: true })
  total: string | null;

  /** Transferencia, efectivo, tarjeta… texto libre. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  medioPago: string | null;

  /** Cuándo pasó a COMPRADO: desde acá corren las 48 h para editarlo. */
  @Column({ type: 'timestamptz', nullable: true })
  compradoAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  entregadoAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  creadoPorId: string | null;

  @Column({ type: 'varchar', length: 80 })
  creadoPorNombre: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  actualizadoPorNombre: string | null;

  @ManyToMany(() => ProveedorCompra)
  @JoinTable({
    name: 'compras_pedidos_proveedores',
    joinColumn: { name: 'pedidoId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'proveedorId', referencedColumnName: 'id' },
  })
  proveedores: ProveedorCompra[];

  @OneToMany(() => PedidoCompraItem, (i) => i.pedido, { cascade: true })
  items: PedidoCompraItem[];

  @OneToMany(() => ComprobanteCompra, (c) => c.pedido)
  comprobantes: ComprobanteCompra[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @VersionColumn()
  version: number;
}

@Entity({ name: 'compras_pedidos_items' })
export class PedidoCompraItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_compras_pedidos_items_pedido')
  @Column({ type: 'uuid' })
  pedidoId: string;

  @ManyToOne(() => PedidoCompra, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedidoId' })
  pedido: PedidoCompra;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  /** El artículo del catálogo de stock. Obligatorio si afecta stock. */
  @Index('ix_compras_pedidos_items_producto')
  @Column({ type: 'uuid', nullable: true })
  productoId: string | null;

  @ManyToOne(() => ProductoStock, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productoId' })
  producto: ProductoStock | null;

  /** Nombre guardado: queda aunque borren el artículo del catálogo. */
  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'int' })
  cantidad: number;

  /** Lo que llegó de verdad (al marcarlo entregado). Null = llegó todo. */
  @Column({ type: 'int', nullable: true })
  cantidadRecibida: number | null;

  @Column({ type: 'numeric', precision: 20, scale: 2, nullable: true })
  precioUnitario: string | null;

  @Column({ type: 'boolean', default: false })
  afectaStock: boolean;

  @ManyToMany(() => CategoriaCompra, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'compras_items_categorias',
    joinColumn: { name: 'itemId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoriaId', referencedColumnName: 'id' },
  })
  categorias: CategoriaCompra[];
}

@Entity({ name: 'compras_comprobantes' })
export class ComprobanteCompra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_compras_comprobantes_pedido')
  @Column({ type: 'uuid' })
  pedidoId: string;

  @ManyToOne(() => PedidoCompra, (p) => p.comprobantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedidoId' })
  pedido: PedidoCompra;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ type: 'int' })
  tamanio: number;

  @Column({ type: 'bytea', select: false })
  datos: Buffer;

  @Column({ type: 'varchar', length: 80, nullable: true })
  subidoPorNombre: string | null;

  /** Copia mandada a Costear (/validar) para conciliarla con el banco. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  costearId: string | null;

  /** PENDIENTE / estado que devuelve Costear / ERROR. Null = no se mandó. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  costearEstado: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  costearDetalle: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  costearEnviadoAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
