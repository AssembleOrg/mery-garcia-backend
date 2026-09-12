import { Injectable, Logger } from '@nestjs/common';
import { RitmoService } from '../ritmo.service';
import type { PunchKind } from '../ritmo.types';

interface HoyRitmo {
  onNow: { userId: string; name: string; statusLabel: string }[];
}

interface PersonalRitmo {
  people: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    initials: string;
    isActive: boolean;
  }[];
}

export interface PersonaKiosco {
  userId: string;
  nombre: string;
  iniciales: string;
  /** Está fichada adentro ahora mismo: el botón que corresponde es SALIDA. */
  presente: boolean;
  estado: string | null;
  proximaMarca: PunchKind;
}

export interface FicharKioscoDto {
  userId: string;
  kind: PunchKind;
  /** Ubicación del aparato del kiosco. Null si no la puede dar. */
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
}

/**
 * Kiosco: una pantalla fija en el salón con los nombres del equipo. Se toca un
 * nombre y ficha, sin que nadie inicie sesión. Es el plan B de cuando el
 * teléfono no está o no da ubicación; lo habitual sigue siendo el celular.
 *
 * La ubicación es la que mide el aparato del kiosco y se manda tal cual. No se
 * inventa un punto fijo: una coordenada repetida exacta la marca Ritmo como GPS
 * simulado, y además sería decir que se midió algo que no se midió.
 */
@Injectable()
export class KioscoService {
  private readonly logger = new Logger(KioscoService.name);

  constructor(private readonly ritmo: RitmoService) {}

  /** El equipo con su estado de ahora, para pintar la pantalla. */
  async estado(): Promise<PersonaKiosco[]> {
    const [hoy, personal] = await Promise.all([
      this.ritmo.consolaHoy() as Promise<HoyRitmo>,
      this.ritmo.listarPersonal() as Promise<PersonalRitmo>,
    ]);

    const adentro = new Map(hoy.onNow.map((p) => [p.userId, p.statusLabel]));

    return personal.people
      .filter((p) => p.role === 'EMPLEADO' && p.isActive)
      .map((p) => {
        const presente = adentro.has(p.id);
        return {
          userId: p.id,
          nombre: p.fullName,
          iniciales: p.initials,
          presente,
          estado: adentro.get(p.id) ?? null,
          proximaMarca: (presente ? 'SALIDA' : 'ENTRADA') as PunchKind,
        };
      });
  }

  /**
   * Ficha por una persona. Usa la clave ADMIN con X-Ritmo-User: para Ritmo la
   * marca es de ella, no del kiosco.
   */
  async fichar(dto: FicharKioscoDto): Promise<unknown> {
    const marca = await this.ritmo.fichar(dto.userId, {
      kind: dto.kind,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      accuracyMeters: dto.accuracyMeters ?? null,
    });
    this.logger.log(`Kiosco: ${dto.kind} de ${dto.userId}`);
    return marca;
  }
}
