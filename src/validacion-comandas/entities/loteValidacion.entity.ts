import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { PaginaValidacion } from './paginaValidacion.entity';

export enum EstadoLote {
  /** Subido: todavía no se leyó nada (la lectura se inicia a mano). */
  SUBIDO = 'SUBIDO',
  LEYENDO = 'LEYENDO',
  LISTO = 'LISTO',
}

/**
 * Un lote = las comandas en papel de un día (normalmente el PDF de Adobe Scan).
 * La fecha del lote es la que se valida contra el sistema: la fecha escrita a
 * mano en el papel se lee mal muy seguido y sólo se muestra como dato.
 */
@Entity({ name: 'validacion_lotes' })
export class LoteValidacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 255 })
  nombreArchivo: string;

  @Column({ type: 'varchar', length: 12, default: EstadoLote.SUBIDO })
  estado: EstadoLote;

  @Column({ type: 'int', default: 0 })
  totalPaginas: number;

  @Column({ type: 'varchar', length: 60, nullable: true })
  modelo: string | null;

  @Column({ type: 'int', default: 0 })
  tokensEntrada: number;

  @Column({ type: 'int', default: 0 })
  tokensSalida: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    default: 0,
    transformer: NumericTransformer,
  })
  costoUsd: number;

  @Column({ type: 'uuid', nullable: true })
  creadoPorId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  creadoPorNombre: string | null;

  @OneToMany(() => PaginaValidacion, (p) => p.lote)
  paginas: PaginaValidacion[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
