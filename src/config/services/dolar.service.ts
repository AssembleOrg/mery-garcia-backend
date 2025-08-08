import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionSistema } from '../entities/ConfiguracionSistema.entity';
import { CotizacionDolar } from '../entities/CotizacionDolar.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { ActualizarDolarDto } from '../dto/actualizar-dolar.dto';

export interface DolarResponse {
  compra: number;
  venta: number;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion?: string;
  fechaCreacion?: string;
}

@Injectable()
export class DolarService {
  private readonly logger = new Logger(DolarService.name);
  private readonly API_URL = 'https://dolarapi.com/v1/dolares/blue';

  constructor(
    @InjectRepository(ConfiguracionSistema)
    private configuracionRepository: Repository<ConfiguracionSistema>,
    @InjectRepository(CotizacionDolar)
    private cotizacionDolarRepository: Repository<CotizacionDolar>,
  ) {}

  async obtenerDolarActual(): Promise<DolarResponse> {
    try {
      this.logger.log('Consultando cotización del dólar blue...');

      const response = await axios.get<DolarResponse>(this.API_URL);
      const dolarData = response.data;

      // Guardar en configuración del sistema
      await this.guardarDolarEnConfiguracion(dolarData);

      this.logger.log(
        `Dólar blue actualizado: Compra $${dolarData.compra}, Venta $${dolarData.venta}`,
      );

      return dolarData;
    } catch (error) {
      this.logger.error('Error consultando dólar blue:', error.message);

      throw new Error('No se pudo obtener la cotización del dólar');
    }
  }

  private async guardarDolarEnConfiguracion(
    dolarData: DolarResponse,
  ): Promise<void> {
    try {
      const cotizacionConfiguracion =
        await this.configuracionRepository.findOne({
          where: { clave: 'dolar_blue' },
        });
      if (cotizacionConfiguracion) {
        await this.configuracionRepository.update(cotizacionConfiguracion.id, {
          valor: JSON.stringify(dolarData),
        });
      } else {
        const nuevaConfiguracion = this.configuracionRepository.create({
          clave: 'dolar_blue',
          valor: JSON.stringify(dolarData),
        });
        await this.configuracionRepository.save(nuevaConfiguracion);
      }
      // Guardar en la nueva tabla de cotizaciones
      const cotizacion = this.cotizacionDolarRepository.create({
        compra: dolarData.compra,
        venta: dolarData.venta,
        casa: dolarData.casa,
        nombre: dolarData.nombre,
        moneda: dolarData.moneda,
        fechaActualizacion: new Date(dolarData.fechaActualizacion!), // TypeORM manejará el timezone automáticamente
        fuente: 'API',
        observaciones: 'Cotización obtenida automáticamente de dolarapi.com',
        // createdAt y updatedAt son manejados automáticamente por TypeORM con timezone AR
      });

      await this.cotizacionDolarRepository.save(cotizacion); 

      this.logger.log('Cotización de dólar guardada en historial');
    } catch (error) {
      this.logger.error('Error guardando cotización de dólar:', error.message);
      throw new Error('No se pudo guardar la cotización del dólar');
    }
  }

  async obtenerUltimoDolarGuardado(): Promise<DolarResponse | null> {
    try {
      const ultimaCotizacion = await this.cotizacionDolarRepository.findOne({
        where: {},
        order: { fechaActualizacion: 'DESC' },
      });

      if (!ultimaCotizacion) {
        throw new NotFoundException(
          'No se encontró la última cotización del dólar',
        );
      }

      return {
        compra: ultimaCotizacion.compra,
        venta: ultimaCotizacion.venta,
        casa: ultimaCotizacion.casa,
        nombre: ultimaCotizacion.nombre,
        moneda: ultimaCotizacion.moneda,
        fechaActualizacion: ultimaCotizacion.fechaActualizacion.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Error obteniendo último dólar guardado:2',
        error.message,
      );
      throw new Error('No se pudo obtener la última cotización del dólar');
    }
  }

  async obtenerUltimoUpdatePorFecha(): Promise<DolarResponse | null> {
    try {
      const ultimaCotizacion = await this.cotizacionDolarRepository.findOne({
        order: { createdAt: 'DESC' },
        where: {},
      });
      if (!ultimaCotizacion) {
        throw new NotFoundException(
          'No se encontró la última cotización del dólar',
        );
      }

      return {
        compra: ultimaCotizacion.compra,
        venta: ultimaCotizacion.venta,
        casa: ultimaCotizacion.casa,
        nombre: ultimaCotizacion.nombre,
        moneda: ultimaCotizacion.moneda,
        fechaActualizacion: ultimaCotizacion.fechaActualizacion.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Error obteniendo último update de dólar por fecha:',
        error.message,
      );
      throw new Error('No se pudo obtener la última cotización del dólar');
    }
  }

  @Cron('0 */3 * * 1-6') // Cada 3 horas, de lunes a sábado
  async actualizarDolarAutomaticamente(): Promise<void> {
    this.logger.log('Ejecutando actualización automática del dólar cada 3 horas...');

    try {
      await this.obtenerDolarActual();
      this.logger.log('Dólar actualizado automáticamente');
    } catch (error) {
      this.logger.error('Error en actualización automática del dólar:', error.message);
    }
  }

  async actualizarDolarManualmente(
    dto: ActualizarDolarDto,
  ): Promise<DolarResponse> {
    try {
      this.logger.log('Actualizando dólar manualmente...');

      const dolarData: DolarResponse = {
        compra: dto.compra,
        venta: dto.venta || dto.compra,
        casa: dto.casa || 'Manual',
        nombre: dto.nombre || 'Blue Manual',
        moneda: dto.moneda || 'USD',
        fechaActualizacion: new Date().toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
        }),
      };

      // Guardar en la nueva tabla de cotizaciones
      const cotizacion = this.cotizacionDolarRepository.create({
        compra: dolarData.compra,
        venta: dolarData.venta,
        casa: dolarData.casa,
        nombre: dolarData.nombre,
        moneda: dolarData.moneda,
        fechaActualizacion: new Date(),
        fuente: 'MANUAL',
        observaciones: dto.observaciones || 'Cotización ingresada manualmente',
      });

      await this.cotizacionDolarRepository.save(cotizacion);

      this.logger.log(
        `Dólar actualizado manualmente: Compra $${dolarData.compra}, Venta $${dolarData.venta}`,
      );

      return dolarData;
    } catch (error) {
      this.logger.error('Error actualizando dólar manualmente:', error.message);
      throw new Error('No se pudo actualizar la cotización del dólar');
    }
  }

  async obtenerHistorialDolar(limit = 10): Promise<DolarResponse[]> {
    try {
      const cotizaciones = await this.cotizacionDolarRepository.find({
        order: { createdAt: 'DESC' },
        take: limit,
      });

      this.logger.log(`Cotizaciones encontradas: ${cotizaciones.length}`);

      return cotizaciones.map((cotizacion) => ({
        compra: cotizacion.compra,
        venta: cotizacion.venta,
        casa: cotizacion.casa,
        nombre: cotizacion.nombre,
        moneda: cotizacion.moneda,
        fechaCreacion: cotizacion.createdAt.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
      }));
    } catch (error) {
      this.logger.error('Error obteniendo historial del dólar:', error.message);
      return [];
    }
  }
}
