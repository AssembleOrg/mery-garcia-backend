import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Una línea del resumen tal como se le mostró a la persona al confirmar. */
export interface LineaResumenConfirmado {
  key: string;
  label: string;
  count: number;
  validadas: number;
}

/**
 * Lo que una trabajadora dijo, desde Ritmo, sobre los servicios que figuran a
 * su nombre un día: "sí, hice eso" o "no coincide, porque…".
 *
 * Una fila por trabajadora y día; volver a confirmar pisa la anterior. Se
 * guarda el resumen que vio en ese momento, porque las comandas de ese día
 * pueden cambiar después (se validan, se corrigen) y hay que poder saber qué
 * fue lo que confirmó.
 */
@Entity({ name: 'ritmo_confirmacion_servicios' })
@Index('uq_confirmacion_servicios_dia', ['trabajadorId', 'dia'], {
  unique: true,
})
export class ConfirmacionServiciosDia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  trabajadorId: string;

  /** Quién confirmó según Ritmo (la misma persona, por su id de allá). */
  @Column({ type: 'uuid' })
  ritmoUserId: string;

  /** YYYY-MM-DD en la zona del salón. */
  @Column({ type: 'date' })
  dia: string;

  /** true = "es correcto"; false = "no coincide". */
  @Column({ type: 'boolean' })
  conforme: boolean;

  @Column({ type: 'text', nullable: true })
  nota: string | null;

  @Column({ type: 'jsonb' })
  resumen: LineaResumenConfirmado[];

  /** En cuántas comandas figuraba al confirmar (null: confirmado antes de contarlas). */
  @Column({ type: 'int', nullable: true })
  comandas: number | null;

  /** Cuántos productos figuraban vendidos al confirmar (null: confirmado antes de contarlos). */
  @Column({ type: 'int', nullable: true })
  productos: number | null;

  /** Id de la marca de salida en Ritmo, si confirmó al cerrar el turno. */
  @Column({ type: 'uuid', nullable: true })
  ritmoPunchId: string | null;

  @Column({ type: 'timestamptz' })
  confirmadoEn: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
