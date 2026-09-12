import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WhatsappContacto } from './entities/WhatsappContacto.entity';
import { Cliente } from '../cliente/entities/Cliente.entity';
import { numeroLocal, soloDigitos, sufijoTelefono } from './telefono';

export interface ClienteResumen {
  id: string;
  nombre: string;
}

@Injectable()
export class ContactosService {
  private readonly logger = new Logger(ContactosService.name);

  constructor(
    @InjectRepository(WhatsappContacto)
    private readonly contactos: Repository<WhatsappContacto>,
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
  ) {}

  /**
   * Busca o crea el contacto del chat. Si es nuevo (o todavía no tenía
   * teléfono ni clienta), intenta cruzarlo con una clienta del ERP.
   */
  async asegurar(
    chatJid: string,
    telefono: string | null,
    nombreWhatsapp: string | null,
  ): Promise<WhatsappContacto> {
    let contacto = await this.contactos.findOne({ where: { chatJid } });
    const telefonoLimpio = telefono ? soloDigitos(telefono) || null : null;

    if (!contacto) {
      contacto = this.contactos.create({
        chatJid,
        telefono: telefonoLimpio,
        nombreWhatsapp,
        clienteId: telefonoLimpio ? await this.buscarClienteId(telefonoLimpio) : null,
      });
      return this.contactos.save(contacto);
    }

    let cambio = false;
    if (nombreWhatsapp && nombreWhatsapp !== contacto.nombreWhatsapp) {
      contacto.nombreWhatsapp = nombreWhatsapp;
      cambio = true;
    }
    if (telefonoLimpio && telefonoLimpio !== contacto.telefono) {
      contacto.telefono = telefonoLimpio;
      cambio = true;
    }
    if (!contacto.clienteId && contacto.telefono) {
      const clienteId = await this.buscarClienteId(contacto.telefono);
      if (clienteId) {
        contacto.clienteId = clienteId;
        cambio = true;
      }
    }
    return cambio ? this.contactos.save(contacto) : contacto;
  }

  async porChatJid(chatJid: string): Promise<WhatsappContacto | null> {
    return this.contactos.findOne({ where: { chatJid } });
  }

  async vincularCliente(contactoId: string, clienteId: string | null): Promise<void> {
    await this.contactos.update({ id: contactoId }, { clienteId });
  }

  /** Nombres de clientas del ERP para un conjunto de contactos. */
  async clientesDe(contactos: WhatsappContacto[]): Promise<Map<string, ClienteResumen>> {
    const ids = [...new Set(contactos.map((c) => c.clienteId).filter((x): x is string => !!x))];
    const mapa = new Map<string, ClienteResumen>();
    if (ids.length === 0) return mapa;
    const filas = await this.clientes.find({
      where: { id: In(ids) },
      select: { id: true, nombre: true },
    });
    for (const f of filas) mapa.set(f.id, { id: f.id, nombre: f.nombre });
    return mapa;
  }

  /**
   * Clienta del ERP con el mismo celular, en cualquiera de sus formas
   * (+54 9 11…, 15…, 011 15…). Se cruza por los últimos 8 dígitos y, si hay
   * más de una, gana la que coincide en el número local completo.
   */
  async buscarClienteId(telefonoE164: string): Promise<string | null> {
    const sufijo = sufijoTelefono(telefonoE164);
    if (!sufijo) return null;
    try {
      const candidatas = await this.clientes
        .createQueryBuilder('c')
        .select(['c.id', 'c.telefono', 'c.fechaRegistro'])
        .where(`RIGHT(regexp_replace(COALESCE(c.telefono, ''), '\\D', '', 'g'), 8) = :sufijo`, { sufijo })
        .andWhere('c.deletedAt IS NULL')
        .orderBy('c.fechaRegistro', 'DESC')
        .limit(10)
        .getMany();
      if (candidatas.length === 0) return null;
      if (candidatas.length === 1) return candidatas[0].id;
      const local = numeroLocal(telefonoE164);
      const exacta = candidatas.find((c) => numeroLocal(c.telefono) === local);
      return (exacta ?? candidatas[0]).id;
    } catch (error) {
      this.logger.warn(`No se pudo cruzar el teléfono con clientas: ${(error as Error).message}`);
      return null;
    }
  }
}
