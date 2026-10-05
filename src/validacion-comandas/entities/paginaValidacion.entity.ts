import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { LoteValidacion } from './loteValidacion.entity';
import type { LecturaComanda } from '../lector-ia.service';
import type { ComandaSistema, Diferencia } from '../comparador';

export enum EstadoPagina {
  PENDIENTE = 'PENDIENTE',
  LEYENDO = 'LEYENDO',
  LEIDA = 'LEIDA',
  ERROR = 'ERROR',
}

export enum ResultadoPagina {
  OK = 'OK',
  REVISAR = 'REVISAR',
  /** El número leído no corresponde a ninguna comanda cargada. */
  NO_ENCONTRADA = 'NO_ENCONTRADA',
}

/**
 * Una hoja (una comanda en papel): la imagen, lo que leyó la IA y la
 * comparación con la comanda del sistema. Sólo informa: nunca cambia la comanda.
 */
@Entity({ name: 'validacion_paginas' })
export class PaginaValidacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  loteId: string;

  @ManyToOne(() => LoteValidacion, (l) => l.paginas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loteId' })
  lote: LoteValidacion;

  /** Posición en el lote (1 = primera hoja). */
  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'varchar', length: 40 })
  mimeType: string;

  /** Los bytes se leen sólo al mostrar la imagen o al mandarla a la IA. */
  @Column({ type: 'bytea', select: false })
  imagen: Buffer;

  @Column({ type: 'varchar', length: 12, default: EstadoPagina.PENDIENTE })
  estado: EstadoPagina;

  /** Respuesta estructurada de la IA (ver LecturaComanda). */
  @Column({ type: 'jsonb', nullable: true })
  lectura: LecturaComanda | null;

  /** Número de comanda en el formato del sistema ("01-11089"). */
  @Index()
  @Column({ type: 'varchar', length: 30, nullable: true })
  numeroComanda: string | null;

  @Column({ type: 'uuid', nullable: true })
  comandaId: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  resultado: ResultadoPagina | null;

  @Column({ type: 'jsonb', nullable: true })
  diferencias: Diferencia[] | null;

  /** Cómo estaba la comanda en el sistema al comparar (para mostrarla al lado del papel). */
  @Column({ type: 'jsonb', nullable: true })
  sistema: ComandaSistema | null;

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

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  leidaAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
