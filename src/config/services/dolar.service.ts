import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionSistema } from '../entities/ConfiguracionSistema.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

export interface DolarResponse {
  compra: number;
  venta: number;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion: string;
}

@Injectable()
export class DolarService {
  private readonly logger = new Logger(DolarService.name);
  private readonly API_URL = 'https://dolarapi.com/v1/dolares/blue';

  constructor(
    @InjectRepository(ConfiguracionSistema)
    private configuracionRepository: Repository<ConfiguracionSistema>,
  ) {}

  async obtenerDolarActual(): Promise<DolarResponse> {
    try {
      this.logger.log('Consultando cotización del dólar blue...');
      
      const response = await axios.get<DolarResponse>(this.API_URL);
      const dolarData = response.data;

      // Guardar en configuración del sistema
      await this.guardarDolarEnConfiguracion(dolarData);

      this.logger.log(`Dólar blue actualizado: Compra $${dolarData.compra}, Venta $${dolarData.venta}`);
      
      return dolarData;
    } catch (error) {
      this.logger.error('Error consultando dólar blue:', error.message);
      
      // Si falla la API, intentar obtener el último valor guardado
      const ultimoValor = await this.obtenerUltimoDolarGuardado();
      if (ultimoValor) {
        this.logger.warn('Usando último valor guardado del dólar');
        return ultimoValor;
      }
      
      throw new Error('No se pudo obtener la cotización del dólar');
    }
  }

  private async guardarDolarEnConfiguracion(dolarData: DolarResponse): Promise<void> {
    try {
      const configuracion = await this.configuracionRepository.findOne({
        where: { clave: 'dolar_blue' },
      });

      const valor = JSON.stringify({
        compra: dolarData.compra,
        venta: dolarData.venta,
        casa: dolarData.casa,
        nombre: dolarData.nombre,
        moneda: dolarData.moneda,
        fechaActualizacion: dolarData.fechaActualizacion,
        fechaConsulta: new Date().toISOString(),
      });

      if (configuracion) {
        configuracion.valor = valor;
        await this.configuracionRepository.save(configuracion);
      } else {
        const nuevaConfig = this.configuracionRepository.create({
          clave: 'dolar_blue',
          valor,
          descripcion: 'Cotización del dólar blue obtenida de dolarapi.com',
          activo: true,
        });
        await this.configuracionRepository.save(nuevaConfig);
      }
    } catch (error) {
      this.logger.error('Error guardando dólar en configuración:', error.message);
    }
  }

  private async obtenerUltimoDolarGuardado(): Promise<DolarResponse | null> {
    try {
      const configuracion = await this.configuracionRepository.findOne({
        where: { clave: 'dolar_blue' },
      });

      if (configuracion) {
        const valor = JSON.parse(configuracion.valor);
        return {
          compra: valor.compra,
          venta: valor.venta,
          casa: valor.casa,
          nombre: valor.nombre,
          moneda: valor.moneda,
          fechaActualizacion: valor.fechaActualizacion,
        };
      }
    } catch (error) {
      this.logger.error('Error obteniendo último dólar guardado:', error.message);
    }
    
    return null;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async actualizarDolarAutomaticamente(): Promise<void> {
    this.logger.log('Ejecutando actualización automática del dólar...');
    
    try {
      await this.obtenerDolarActual();
      this.logger.log('Dólar actualizado automáticamente');
    } catch (error) {
      this.logger.error('Error en actualización automática del dólar:', error.message);
    }
  }

  async obtenerHistorialDolar(limit = 10): Promise<DolarResponse[]> {
    try {
      const configuraciones = await this.configuracionRepository.find({
        where: { clave: 'dolar_blue' },
        order: { updatedAt: 'DESC' },
        take: limit,
      });

      return configuraciones.map(config => {
        const valor = JSON.parse(config.valor);
        return {
          compra: valor.compra,
          venta: valor.venta,
          casa: valor.casa,
          nombre: valor.nombre,
          moneda: valor.moneda,
          fechaActualizacion: valor.fechaActualizacion,
        };
      });
    } catch (error) {
      this.logger.error('Error obteniendo historial del dólar:', error.message);
      return [];
    }
  }
} 