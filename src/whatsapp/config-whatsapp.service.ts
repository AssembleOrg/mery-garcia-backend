import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HORARIO_POR_DEFECTO,
  HorarioAtencion,
  MENSAJES_POR_DEFECTO,
  MensajesBot,
  WhatsappConfig,
} from './entities/WhatsappConfig.entity';
import { WhatsappRespuesta } from './entities/WhatsappRespuesta.entity';
import { RESPUESTAS_SEMILLA } from './respuestas.seed';
import { horarioValido } from './horario';

export interface RespuestaInput {
  clave: string;
  titulo: string;
  descripcion: string;
  ejemplos: string[];
  respuesta: string;
  derivaAPersona?: boolean;
  activa?: boolean;
  orden?: number;
}

export interface ConfigInput {
  botActivo?: boolean;
  horario?: HorarioAtencion;
  mensajes?: Partial<MensajesBot>;
  menuOpcion1?: string;
  menuOpcion2?: string;
}

const CLAVE_VALIDA = /^[A-Z][A-Z0-9_]{1,63}$/;
const RESERVADAS = new Set(['NO_SE', 'PERSONA']);

@Injectable()
export class ConfigWhatsappService implements OnModuleInit {
  private readonly logger = new Logger(ConfigWhatsappService.name);

  constructor(
    @InjectRepository(WhatsappConfig)
    private readonly configRepo: Repository<WhatsappConfig>,
    @InjectRepository(WhatsappRespuesta)
    private readonly respuestas: Repository<WhatsappRespuesta>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.obtener();
      await this.sembrarSiEstaVacio();
    } catch (error) {
      this.logger.warn(`No se pudo inicializar la config de WhatsApp: ${(error as Error).message}`);
    }
  }

  async obtener(): Promise<WhatsappConfig> {
    let fila = await this.configRepo.findOne({ where: { id: 'default' } });
    if (!fila) {
      fila = await this.configRepo.save(
        this.configRepo.create({
          id: 'default',
          botActivo: true,
          horario: HORARIO_POR_DEFECTO,
          mensajes: MENSAJES_POR_DEFECTO,
        }),
      );
    }
    // Un texto nuevo agregado al código aparece con su default sin migración.
    fila.mensajes = { ...MENSAJES_POR_DEFECTO, ...(fila.mensajes ?? {}) };
    return fila;
  }

  async actualizar(input: ConfigInput): Promise<WhatsappConfig> {
    const fila = await this.obtener();
    if (input.botActivo !== undefined) fila.botActivo = Boolean(input.botActivo);
    if (input.horario !== undefined) {
      if (!horarioValido(input.horario)) {
        throw new BadRequestException('Horario inválido: días 1..7 y horas HH:mm, desde < hasta.');
      }
      fila.horario = {
        dias: [...new Set(input.horario.dias)].sort((a, b) => a - b),
        desde: input.horario.desde,
        hasta: input.horario.hasta,
      };
    }
    if (input.mensajes) {
      const limpios: Partial<MensajesBot> = {};
      for (const clave of Object.keys(MENSAJES_POR_DEFECTO) as (keyof MensajesBot)[]) {
        const v = input.mensajes[clave];
        if (typeof v === 'string') {
          if (v.trim().length === 0 || v.length > 2000) {
            throw new BadRequestException(`El mensaje "${clave}" tiene que tener entre 1 y 2000 caracteres.`);
          }
          limpios[clave] = v;
        }
      }
      fila.mensajes = { ...fila.mensajes, ...limpios };
    }
    for (const campo of ['menuOpcion1', 'menuOpcion2'] as const) {
      const v = input[campo];
      if (v !== undefined) {
        if (!CLAVE_VALIDA.test(v) || !(await this.respuestas.exist({ where: { clave: v } }))) {
          throw new BadRequestException(`${campo}: la clave "${v}" no existe.`);
        }
        fila[campo] = v;
      }
    }
    return this.configRepo.save(fila);
  }

  // ─── Respuestas ────────────────────────────────────────────────

  async listarRespuestas(): Promise<WhatsappRespuesta[]> {
    return this.respuestas.find({ order: { orden: 'ASC', createdAt: 'ASC' } });
  }

  async respuestasActivas(): Promise<WhatsappRespuesta[]> {
    return this.respuestas.find({ where: { activa: true }, order: { orden: 'ASC' } });
  }

  async respuestaPorClave(clave: string): Promise<WhatsappRespuesta | null> {
    return this.respuestas.findOne({ where: { clave } });
  }

  async crearRespuesta(input: RespuestaInput): Promise<WhatsappRespuesta> {
    const datos = this.validarRespuesta(input);
    if (await this.respuestas.exist({ where: { clave: datos.clave } })) {
      throw new BadRequestException(`Ya existe una respuesta con la clave ${datos.clave}.`);
    }
    return this.respuestas.save(this.respuestas.create(datos));
  }

  async editarRespuesta(id: string, input: Partial<RespuestaInput>): Promise<WhatsappRespuesta> {
    const fila = await this.respuestas.findOne({ where: { id } });
    if (!fila) throw new NotFoundException('Respuesta no encontrada.');
    const datos = this.validarRespuesta({ ...fila, ...input });
    if (datos.clave !== fila.clave && (await this.respuestas.exist({ where: { clave: datos.clave } }))) {
      throw new BadRequestException(`Ya existe una respuesta con la clave ${datos.clave}.`);
    }
    Object.assign(fila, datos);
    return this.respuestas.save(fila);
  }

  async borrarRespuesta(id: string): Promise<void> {
    const fila = await this.respuestas.findOne({ where: { id } });
    if (!fila) throw new NotFoundException('Respuesta no encontrada.');
    const cfg = await this.obtener();
    if (fila.clave === cfg.menuOpcion1 || fila.clave === cfg.menuOpcion2) {
      throw new BadRequestException('Esta respuesta está en el menú de "no entendí". Cambiá el menú antes de borrarla.');
    }
    await this.respuestas.delete({ id });
  }

  private validarRespuesta(input: Partial<RespuestaInput>): RespuestaInput {
    const clave = (input.clave ?? '').trim().toUpperCase();
    if (!CLAVE_VALIDA.test(clave)) {
      throw new BadRequestException('La clave va en MAYÚSCULAS, con guiones bajos, 2 a 64 caracteres.');
    }
    if (RESERVADAS.has(clave)) throw new BadRequestException(`La clave ${clave} está reservada.`);
    const titulo = (input.titulo ?? '').trim();
    const descripcion = (input.descripcion ?? '').trim();
    const respuesta = (input.respuesta ?? '').trim();
    if (!titulo || titulo.length > 160) throw new BadRequestException('Título: 1 a 160 caracteres.');
    if (!descripcion || descripcion.length > 600) throw new BadRequestException('Descripción: 1 a 600 caracteres.');
    if (!respuesta || respuesta.length > 4000) throw new BadRequestException('Respuesta: 1 a 4000 caracteres.');
    const ejemplos = (Array.isArray(input.ejemplos) ? input.ejemplos : [])
      .map((e) => String(e).trim())
      .filter((e) => e.length > 0 && e.length <= 200)
      .slice(0, 12);
    return {
      clave,
      titulo,
      descripcion,
      respuesta,
      ejemplos,
      derivaAPersona: Boolean(input.derivaAPersona),
      activa: input.activa === undefined ? true : Boolean(input.activa),
      orden: Number.isInteger(input.orden) ? (input.orden as number) : 0,
    };
  }

  private async sembrarSiEstaVacio(): Promise<void> {
    if ((await this.respuestas.count()) > 0) return;
    await this.respuestas.save(
      RESPUESTAS_SEMILLA.map((s, i) =>
        this.respuestas.create({ ...s, derivaAPersona: Boolean(s.derivaAPersona), activa: true, orden: i }),
      ),
    );
    this.logger.log(`Respuestas iniciales cargadas: ${RESPUESTAS_SEMILLA.length}`);
  }
}
