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
  latitude: number;
  longitude: number;
  accuracyMeters: number;
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

export interface LiquidacionParams {
  /** YYYY-MM-DD */
  desde: string;
  /** YYYY-MM-DD */
  hasta: string;
  /** conceptos separados por coma, ej "normales,extra50" */
  conceptos?: string;
}
