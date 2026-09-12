import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Cada cuánto se repite un tramo del patrón.
 *
 * Casi todos los tramos son TODAS. Las otras dos existen por el sábado por
 * medio: un tramo va en las semanas A y otro en las B, y la semana ancla
 * (RitmoTurnosConfig) define cuál es cuál.
 */
export enum AlternanciaTurno {
  TODAS = 'TODAS',
  SEMANA_A = 'SEMANA_A',
  SEMANA_B = 'SEMANA_B',
}

/**
 * Un tramo del horario fijo de una persona: "los martes de 10 a 18".
 *
 * Ritmo no repite semanas —cada turno se carga uno por uno—, así que este
 * patrón es la fuente de la que el generador arma la semana. Vive acá y no en
 * Ritmo porque es nuestro, y acá se puede editar desde la pantalla.
 *
 * Editar un tramo cambia el horario de ahí en adelante; para tocar un solo día
 * se edita el turno de ese día en el calendario, sin pasar por el patrón.
 */
@Entity({ name: 'ritmo_patron_turno' })
@Index(['ritmoUserId', 'diaIso'])
export class PatronTurno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Id de la persona en Ritmo. Es lo estable: el email puede cambiar. */
  @Column({ type: 'uuid' })
  ritmoUserId: string;

  /** Copia del nombre para poder leer la tabla sin ir a Ritmo. */
  @Column({ type: 'text' })
  nombre: string;

  /** 1 = lunes … 7 = domingo (ISO). */
  @Column({ type: 'smallint' })
  diaIso: number;

  /** Minutos desde la medianoche, en la zona de la empresa. 600 = 10:00. */
  @Column({ type: 'int' })
  desdeMinuto: number;

  @Column({ type: 'int' })
  hastaMinuto: number;

  /** Jornada corrida = 0. */
  @Column({ type: 'int', default: 0 })
  pausaMinutos: number;

  @Column({
    type: 'enum',
    enum: AlternanciaTurno,
    enumName: 'ritmo_alternancia_turno_enum',
    default: AlternanciaTurno.TODAS,
  })
  alternancia: AlternanciaTurno;

  /** Un tramo apagado no genera turnos, pero queda como historia. */
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
