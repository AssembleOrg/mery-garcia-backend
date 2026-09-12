// Tipos del sistema Ritmo (presentismo / turnos / liquidación).
// Basado en INTEGRACION.md — respuestas siempre { ok, data, meta } o { ok:false, error }.

export type RolRitmo = 'ADMIN' | 'SUPERVISOR' | 'CONTABLE' | 'EMPLEADO';

export type PunchKind = 'ENTRADA' | 'SALIDA' | 'PAUSA_INICIO' | 'PAUSA_FIN';

export type LicenciaKind =
  | 'LICENCIA_MEDICA'
  | 'VACACIONES'
  | 'PERSONAL'
  | 'OTRA';

export type IncidenciaDecision = 'APROBADA' | 'RECHAZADA';

export interface RitmoMeta {
  requestId?: string;
  timestamp?: string;
  path?: string;
}

export interface RitmoOk<T> {
  ok: true;
  data: T;
  meta?: RitmoMeta;
}

export interface RitmoErrorDetail {
  field?: string;
  message: string;
}

export interface RitmoErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: RitmoErrorDetail[];
  };
  meta?: RitmoMeta;
}

// ---- Payloads de request ----

export interface FicharDto {
  kind: PunchKind;
  /**
   * Ubicación medida por el aparato. Va en null cuando no hay: Ritmo decide
   * según la regla de la empresa (rechaza, o entra a revisión).
   */
  latitude: number | null;
  longitude: number | null;
  /** Precisión que reporta el aparato, en metros. */
  accuracyMeters: number | null;
  /** ISO 8601 UTC. Opcional; por defecto el instante del servidor. */
  happenedAt?: string;
}

export interface SolicitarLicenciaDto {
  kind: LicenciaKind;
  /** YYYY-MM-DD en la zona de la empresa */
  startsOn: string;
  /** YYYY-MM-DD en la zona de la empresa */
  endsOn: string;
  note?: string;
}

export interface CrearPersonaDto {
  fullName: string;
  email: string;
  rol?: RolRitmo;
  employeeCode?: string;
  worksiteId?: string;
  [key: string]: unknown;
}

export interface ResolverIncidenciasDto {
  ids: string[];
  decision: IncidenciaDecision;
}

// ---- Reporte de asistencia (GET /api/consola/asistencia) ----

export type EstadoDia =
  | 'TRABAJADO'
  | 'INCOMPLETO'
  | 'AUSENTE'
  | 'LICENCIA'
  | 'SIN_TURNO';

export type RevisionDia = 'VALIDO' | 'PENDIENTE' | 'RECHAZADO';

export interface FilaAsistencia {
  userId: string;
  fullName: string;
  employeeCode: string | null;
  /** YYYY-MM-DD en la zona de la empresa. */
  day: string;
  /** "HH:MM" del turno planificado, si había. */
  shiftStart: string | null;
  shiftEnd: string | null;
  plannedMinutes: number;
  checkIn: string | null;
  checkOut: string | null;
  breakMinutes: number;
  workedMinutes: number;
  /** Negativo = trabajó menos de lo planificado. */
  balanceMinutes: number;
  lateMinutes: number;
  punches: number;
  state: EstadoDia;
  review: RevisionDia | null;
  reviewReason: string | null;
  absenceKind: string | null;
  absenceStatus: string | null;
}

export interface AsistenciaRitmo {
  from: string;
  to: string;
  timezone: string;
  rows: FilaAsistencia[];
  summary: {
    people: number;
    days: number;
    workedMinutes: number;
    plannedMinutes: number;
    pendingDays: number;
    absentDays: number;
    leaveDays: number;
    lateDays: number;
  };
}

export interface LiquidacionParams {
  /** YYYY-MM-DD */
  desde: string;
  /** YYYY-MM-DD */
  hasta: string;
  /** conceptos separados por coma, ej "normales,extra50" */
  conceptos?: string;
}
