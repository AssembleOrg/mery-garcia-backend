import { WhatsappContacto } from './entities/WhatsappContacto.entity';
import { WhatsappConversacion } from './entities/WhatsappConversacion.entity';
import { WhatsappMensaje } from './entities/WhatsappMensaje.entity';
import { formatearTelefono } from './telefono';
import {
  AutorMensaje,
  DireccionMensaje,
  EstadoConversacion,
  EstadoEnvio,
  MotivoCierre,
  MotivoEspera,
  TipoMensaje,
} from './whatsapp.enums';

/**
 * Lo que sale hacia la web. A propósito NO lleva `chatJid`: la gente ve el
 * teléfono (o el nombre de WhatsApp si el número no se pudo resolver), nunca
 * un identificador interno.
 */
export interface ContactoDto {
  id: string;
  /** "+54 9 11 3658-5581" o null. */
  telefono: string | null;
  /** Sólo dígitos, para armar un link wa.me o buscar. */
  telefonoDigitos: string | null;
  nombreWhatsapp: string | null;
  cliente: { id: string; nombre: string } | null;
  /** Lo que se muestra como título: clienta del ERP > nombre de WhatsApp > teléfono. */
  etiqueta: string;
}

export interface ConversacionDto {
  id: string;
  estado: EstadoConversacion;
  motivoEspera: MotivoEspera | null;
  contacto: ContactoDto;
  atendidaPor: { id: string; nombre: string } | null;
  noLeidos: number;
  ultimoMensajeAt: string | null;
  ultimoEntranteAt: string | null;
  esperandoDesde: string | null;
  iniciadaAt: string;
  cerradaAt: string | null;
  motivoCierre: MotivoCierre | null;
  ultimoMensaje: { texto: string | null; tipo: TipoMensaje; autor: AutorMensaje } | null;
}

export interface MensajeDto {
  id: string;
  conversacionId: string;
  direccion: DireccionMensaje;
  autor: AutorMensaje;
  operador: { id: string; nombre: string } | null;
  tipo: TipoMensaje;
  texto: string | null;
  adjunto: {
    mimeType: string;
    nombreArchivo: string | null;
    tamanoBytes: number | null;
    duracionSegundos: number | null;
  } | null;
  respuestaClave: string | null;
  estadoEnvio: EstadoEnvio | null;
  createdAt: string;
}

function iso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  return fecha instanceof Date ? fecha.toISOString() : new Date(fecha).toISOString();
}

export function etiquetaContacto(
  contacto: WhatsappContacto,
  cliente: { id: string; nombre: string } | null,
): string {
  return (
    cliente?.nombre ||
    contacto.nombreWhatsapp ||
    formatearTelefono(contacto.telefono) ||
    'Sin número'
  );
}

export function aContactoDto(
  contacto: WhatsappContacto,
  cliente: { id: string; nombre: string } | null,
): ContactoDto {
  return {
    id: contacto.id,
    telefono: formatearTelefono(contacto.telefono),
    telefonoDigitos: contacto.telefono,
    nombreWhatsapp: contacto.nombreWhatsapp,
    cliente,
    etiqueta: etiquetaContacto(contacto, cliente),
  };
}

export function aConversacionDto(
  c: WhatsappConversacion,
  cliente: { id: string; nombre: string } | null,
  ultimo: WhatsappMensaje | null,
): ConversacionDto {
  return {
    id: c.id,
    estado: c.estado,
    motivoEspera: c.motivoEspera,
    contacto: aContactoDto(c.contacto, cliente),
    atendidaPor: c.atendidaPor ? { id: c.atendidaPor.id, nombre: c.atendidaPor.nombre } : null,
    noLeidos: c.noLeidos,
    ultimoMensajeAt: iso(c.ultimoMensajeAt),
    ultimoEntranteAt: iso(c.ultimoEntranteAt),
    esperandoDesde: iso(c.esperandoDesde),
    iniciadaAt: iso(c.createdAt) as string,
    cerradaAt: iso(c.cerradaAt),
    motivoCierre: c.motivoCierre,
    ultimoMensaje: ultimo ? { texto: ultimo.texto, tipo: ultimo.tipo, autor: ultimo.autor } : null,
  };
}

export function aMensajeDto(m: WhatsappMensaje): MensajeDto {
  return {
    id: m.id,
    conversacionId: m.conversacionId,
    direccion: m.direccion,
    autor: m.autor,
    operador: m.operador ? { id: m.operador.id, nombre: m.operador.nombre } : null,
    tipo: m.tipo,
    texto: m.texto,
    adjunto: m.adjuntoId
      ? {
          mimeType: m.mimeType ?? 'application/octet-stream',
          nombreArchivo: m.nombreArchivo,
          tamanoBytes: m.tamanoBytes,
          duracionSegundos: m.duracionSegundos,
        }
      : null,
    respuestaClave: m.respuestaClave,
    estadoEnvio: m.estadoEnvio,
    createdAt: iso(m.createdAt) as string,
  };
}
