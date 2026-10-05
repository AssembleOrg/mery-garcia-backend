import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import anthropicConfig from '../config/anthropic.config';

/** Lo que devuelve la IA por cada hoja (mismo esquema que se usó en la prueba con 40 comandas). */
export interface LecturaComanda {
  numero: string | null;
  fecha: string | null;
  cliente: string | null;
  servicios: {
    fila: string;
    responsable: string | null;
    anotacion: string | null;
  }[];
  otros: string[];
  montos: {
    donde: 'SENA' | 'SALDO' | 'SENA_PROXIMO' | 'OTROS' | 'OBSERVACIONES';
    etiquetaTachada: boolean;
    monto: number | null;
    moneda: 'ARS' | 'USD' | null;
    metodo: string | null;
    texto: string;
  }[];
  observaciones: string | null;
  anulada: boolean;
  dudas: string[];
  legibilidad: 'buena' | 'regular' | 'mala';
}

export interface ResultadoLectura {
  lectura: LecturaComanda;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  costoUsd: number;
}

/** USD por millón de tokens (entrada, salida). */
const PRECIOS: Record<string, [number, number]> = {
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
  'claude-haiku-4-5': [1, 5],
};

const FILAS = [
  'MODELADO',
  'MODELADO MERY',
  'TINTE DE CEJAS',
  'LAMINADO',
  'REFILL',
  'LIFTING',
  'TINTE DE PESTAÑAS',
  'NANOBLADING / 1RA SESIÓN',
  'NANOBLADING / RETOQUE',
  'NANOBLADING / MANTENIMIENTO',
  'LIP BLUSH',
  'LASHES LINE',
  'CAMUFLAJE',
  'OTROS',
];

const PROMPT = `Transcribís comandas en papel de un salón de belleza (Argentina). Transcribí SOLO lo que se ve. No adivines: si algo no se lee, null y anotalo en "dudas".

FORMULARIO: número preimpreso "N°0XXXXX"; "Fecha" a mano (d/m/aa, año 2026); "Nombre" de la clienta.
Filas impresas de servicios, en este orden de arriba a abajo:
MODELADO, MODELADO MERY, TINTE DE CEJAS, LAMINADO, REFILL, LIFTING, TINTE DE PESTAÑAS, NANOBLADING / 1RA SESIÓN, NANOBLADING / RETOQUE, NANOBLADING / MANTENIMIENTO, LIP BLUSH, LASHES LINE, CAMUFLAJE, OTROS.
Columna derecha RESPONSABLE: nombre/iniciales de la profesional (Mery, Ro=Rosario, Luna, Mica...).
Abajo: SEÑA, SALDO, SEÑA PRÓXIMO SERVICIO (monto en la columna derecha; método escrito a la izquierda del $ o U$S) y Observaciones.

CÓMO DECIDIR LA FILA DE CADA MARCA (las fotos pueden estar torcidas):
- Ubicá cada tilde/guión/punto/iniciales siguiendo la LÍNEA HORIZONTAL impresa que la contiene, no la altura absoluta en la foto.
- Una fila está marcada si tiene tilde/guión/punto junto al texto impreso, o iniciales en RESPONSABLE de esa misma fila. La firma de la clienta suele cruzar varias filas: NO cuenta como marca por sí sola.
- Si una marca o un responsable cae entre dos filas o en una fila distinta a la del tilde, anotalo en "dudas" diciendo las dos filas candidatas.
- La gente escribe cosas encima de filas que no corresponden (ej. "consulta" sobre CAMUFLAJE, "solo ins." sobre RETOQUE). Copiá ese texto en "anotacion" de esa fila.

DINERO: listá TODOS los montos que aparezcan en la hoja, en cualquier fila (SEÑA, SALDO, SEÑA PRÓXIMO, OTROS, Observaciones, incluso si la etiqueta está tachada). Para cada uno: dónde está, monto, moneda ($ = ARS, U$S/USD = dólares), método si figura (TRANSF, EF, tarjeta, QR, MP, gift...) y el texto tal cual. Prestá mucha atención a la cantidad de ceros (400 vs 40, 7.500 vs 75.000). Si la etiqueta de la fila está tachada, decilo.

ANULADA: si dice "error", "anulada", "no vino", "descartada" o similar, anulada=true.

Montos como número sin separadores (150000). Fecha como AAAA-MM-DD. En "otros" va el texto escrito en la fila OTROS.`;

const NUL = (t: Record<string, unknown>) => ({ anyOf: [t, { type: 'null' }] });
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'numero',
    'fecha',
    'cliente',
    'servicios',
    'otros',
    'montos',
    'observaciones',
    'anulada',
    'dudas',
    'legibilidad',
  ],
  properties: {
    numero: NUL({ type: 'string' }),
    fecha: NUL({ type: 'string', description: 'AAAA-MM-DD' }),
    cliente: NUL({ type: 'string' }),
    servicios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fila', 'responsable', 'anotacion'],
        properties: {
          fila: { type: 'string', enum: FILAS },
          responsable: NUL({ type: 'string' }),
          anotacion: NUL({ type: 'string' }),
        },
      },
    },
    otros: { type: 'array', items: { type: 'string' } },
    montos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'donde',
          'etiquetaTachada',
          'monto',
          'moneda',
          'metodo',
          'texto',
        ],
        properties: {
          donde: {
            type: 'string',
            enum: ['SENA', 'SALDO', 'SENA_PROXIMO', 'OTROS', 'OBSERVACIONES'],
          },
          etiquetaTachada: { type: 'boolean' },
          monto: NUL({ type: 'number' }),
          moneda: NUL({ type: 'string', enum: ['ARS', 'USD'] }),
          metodo: NUL({ type: 'string' }),
          texto: { type: 'string' },
        },
      },
    },
    observaciones: NUL({ type: 'string' }),
    anulada: { type: 'boolean' },
    dudas: { type: 'array', items: { type: 'string' } },
    legibilidad: { type: 'string', enum: ['buena', 'regular', 'mala'] },
  },
};

/**
 * Lee una comanda en papel con Claude. Una llamada por hoja, sin ver nada del
 * sistema: la comparación la hace después el código, con reglas fijas, para
 * que la IA no "confirme" lo que espera ver.
 */
@Injectable()
export class LectorComandasService {
  private readonly logger = new Logger(LectorComandasService.name);
  private readonly client: Anthropic | null;
  private readonly modelo: string;

  constructor(
    @Inject(anthropicConfig.KEY) cfg: ConfigType<typeof anthropicConfig>,
  ) {
    this.client = cfg.apiKey
      ? new Anthropic({ apiKey: cfg.apiKey, maxRetries: 4 })
      : null;
    this.modelo = cfg.modeloComandas;
  }

  get configurado(): boolean {
    return this.client !== null;
  }

  async leer(
    imagen: Buffer,
    mimeType: 'image/jpeg' | 'image/png',
  ): Promise<ResultadoLectura> {
    if (!this.client)
      throw new Error(
        'Falta ANTHROPIC_API_KEY: la lectura con IA no está configurada.',
      );
    const r = await this.client.beta.messages.create({
      model: this.modelo,
      max_tokens: 16000,
      system: PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imagen.toString('base64'),
              },
            },
            { type: 'text', text: 'Transcribí esta comanda.' },
          ],
        },
      ],
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ESQUEMA },
      },
      // Si un filtro de seguridad rechaza la hoja, el servidor reintenta con otro modelo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (r.stop_reason === 'refusal') {
      throw new Error(
        `El modelo no quiso leer la hoja (${r.stop_details?.category ?? 'sin motivo'}).`,
      );
    }
    if (r.stop_reason === 'max_tokens')
      throw new Error('La respuesta de la IA quedó cortada.');
    const texto = r.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('');
    const lectura = JSON.parse(texto) as LecturaComanda;
    const [pi, po] = PRECIOS[r.model] ?? PRECIOS[this.modelo] ?? [0, 0];
    const tokensEntrada = r.usage.input_tokens;
    const tokensSalida = r.usage.output_tokens;
    if (r.model !== this.modelo)
      this.logger.warn(`Hoja leída por ${r.model} (fallback)`);
    return {
      lectura,
      modelo: r.model,
      tokensEntrada,
      tokensSalida,
      costoUsd: (tokensEntrada * pi + tokensSalida * po) / 1e6,
    };
  }
}
