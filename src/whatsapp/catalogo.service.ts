import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import whatsappConfig from '../config/whatsapp.config';

/** Una formación del portal (GET /api/public/catalog). */
interface Formacion {
  slug: string;
  nombre: string;
  descripcion: string;
  precioARS: number | null;
  precioUSD: number | null;
  precioListaARS: number | null;
  enPromocion: boolean;
}

/** Un servicio de la web de turnos (GET /api/services/visible/all). */
interface ServicioTurno {
  name: string;
  /** Seña que se paga al reservar (siempre ARS). */
  price: number | null;
  listPrice: number | null;
  effectivePrice: number | null;
  listCurrency: 'ARS' | 'USD';
}

/** El portal usa este número como "sin precio en pesos". */
const SIN_PRECIO = 99_999_999;
/** Cada cuánto se refrescan los datos. */
const VIGENCIA_MS = 10 * 60_000;
/** Si la fuente se cae, se sigue usando lo último bueno hasta este límite. */
const VIGENCIA_MAXIMA_MS = 24 * 60 * 60_000;

export const WEB_FORMACIONES = 'https://merygarcia.com.ar/formaciones';
export const WEB_TURNOS = 'https://merygarciabooking.com';

const FALTA_FORMACIONES = `Los valores actualizados los ves en ${WEB_FORMACIONES}`;
const FALTA_SERVICIOS = `Los valores actualizados los ves en ${WEB_TURNOS}`;

/** "{formaciones}", "{formacion:slug}" o "{servicios:patron|patron}". */
const MARCADOR = /\{(formaciones|formacion:[a-z0-9-]+|servicios:[^{}]+)\}/g;

function plata(monto: number, moneda: 'ARS' | 'USD'): string {
  return `${moneda === 'USD' ? 'U$S' : 'AR$'} ${Math.round(monto).toLocaleString('es-AR')}`;
}

function sinTildes(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function precioFormacion(f: Formacion): string {
  const partes: string[] = [];
  const ars =
    f.precioARS && f.precioARS > 0 && f.precioARS < SIN_PRECIO
      ? f.precioARS
      : null;
  if (ars) partes.push(plata(ars, 'ARS'));
  if (f.precioUSD && f.precioUSD > 0) partes.push(plata(f.precioUSD, 'USD'));
  if (!partes.length) return 'valor a consultar';
  const antes =
    f.enPromocion && ars && f.precioListaARS && f.precioListaARS > ars
      ? ` (antes ${plata(f.precioListaARS, 'ARS')})`
      : '';
  return partes.join(' / ') + antes;
}

function lineaServicio(s: ServicioTurno): string {
  const partes: string[] = [];
  if (s.listPrice && s.listPrice > 0)
    partes.push(plata(s.listPrice, s.listCurrency));
  if (
    s.effectivePrice &&
    s.effectivePrice > 0 &&
    s.effectivePrice !== s.listPrice
  ) {
    partes.push(`${plata(s.effectivePrice, s.listCurrency)} en efectivo`);
  }
  // Las consultas se pagan completas al reservar: la "seña" es el precio.
  const senaIgual = s.listCurrency === 'ARS' && s.listPrice === s.price;
  const sena =
    s.price && s.price > 0
      ? senaIgual
        ? ' (se abona completo al reservar)'
        : ` · seña ${plata(s.price, 'ARS')}`
      : '';
  const precio = partes.length ? partes.join(' / ') : 'valor a consultar';
  return `• ${s.name.trim()}: ${precio}${sena}`;
}

/**
 * Datos en vivo para las respuestas del bot. Las respuestas siguen siendo textos
 * fijos de la tabla; esto sólo reemplaza marcadores con lo que publican el portal
 * de formaciones y la web de turnos. Nunca inventa: si una fuente no responde o
 * el marcador no encuentra nada, va el link a la web en lugar del precio.
 */
@Injectable()
export class CatalogoService {
  private readonly logger = new Logger(CatalogoService.name);
  private readonly cache = new Map<string, { datos: unknown[]; en: number }>();

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly cfg: ConfigType<typeof whatsappConfig>,
  ) {}

  /** Reemplaza los marcadores de datos en vivo del texto. */
  async completar(texto: string): Promise<string> {
    const marcadores = [...new Set(texto.match(MARCADOR) ?? [])];
    if (!marcadores.length) return texto;
    let salida = texto;
    for (const m of marcadores) {
      salida = salida.split(m).join(await this.resolver(m.slice(1, -1)));
    }
    return salida;
  }

  private async resolver(marcador: string): Promise<string> {
    if (marcador === 'formaciones' || marcador.startsWith('formacion:')) {
      const formaciones = await this.traer<Formacion>(
        this.cfg.fuentes.catalogoFormacionesUrl,
        (d) => (d as { data?: { cursos?: unknown[] } })?.data?.cursos,
      );
      if (!formaciones?.length) return FALTA_FORMACIONES;
      if (marcador === 'formaciones') {
        return formaciones
          .map((f) => `• *${f.nombre.trim()}*: ${precioFormacion(f)}`)
          .join('\n');
      }
      const f = formaciones.find(
        (x) => x.slug === marcador.slice('formacion:'.length),
      );
      if (!f) return FALTA_FORMACIONES;
      const descripcion = (f.descripcion ?? '').trim();
      return `*${f.nombre.trim()}*: ${precioFormacion(f)}${descripcion ? `\n${descripcion}` : ''}`;
    }

    const patrones = marcador
      .slice('servicios:'.length)
      .split('|')
      .map((p) => sinTildes(p.trim()))
      .filter(Boolean);
    const servicios = await this.traer<ServicioTurno>(
      this.cfg.fuentes.serviciosTurnosUrl,
      (d) => (Array.isArray(d) ? d : (d as { data?: unknown[] })?.data),
    );
    if (!servicios?.length) return FALTA_SERVICIOS;
    const elegidos = servicios.filter((s) => {
      const nombre = sinTildes(s.name ?? '');
      // Los "Last Minute" son cupos puntuales con otro precio: no son la tarifa del servicio.
      return (
        !nombre.includes('last minute') &&
        patrones.some((p) => nombre.includes(p))
      );
    });
    return elegidos.length
      ? elegidos.map(lineaServicio).join('\n')
      : FALTA_SERVICIOS;
  }

  /** GET con caché. Si falla, sigue con lo último bueno; si no hay nada, null. */
  private async traer<T>(
    url: string,
    extraer: (cuerpo: unknown) => unknown,
  ): Promise<T[] | null> {
    const guardado = this.cache.get(url);
    if (guardado && Date.now() - guardado.en < VIGENCIA_MS)
      return guardado.datos as T[];
    try {
      const { data } = await axios.get<unknown>(url, { timeout: 5_000 });
      const lista = extraer(data);
      if (!Array.isArray(lista)) throw new Error('respuesta con otro formato');
      this.cache.set(url, { datos: lista, en: Date.now() });
      return lista as T[];
    } catch (error) {
      this.logger.warn(
        `No se pudieron traer datos de ${url}: ${(error as Error).message}`,
      );
      if (guardado && Date.now() - guardado.en < VIGENCIA_MAXIMA_MS)
        return guardado.datos as T[];
      return null;
    }
  }
}
