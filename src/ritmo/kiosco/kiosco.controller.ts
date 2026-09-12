import { Body, Controller, Get, Post } from '@nestjs/common';
import { FicharKioscoDto, KioscoService } from './kiosco.service';

/**
 * Pantalla de kiosco del salón. Es presentismo, así que vive en la app; el
 * resto de Ritmo sigue fuera.
 */
@Controller('ritmo/kiosco')
export class KioscoController {
  constructor(private readonly kiosco: KioscoService) {}

  /** Equipo con su estado de ahora: a quién le toca ENTRADA y a quién SALIDA. */
  @Get()
  estado() {
    return this.kiosco.estado();
  }

  /**
   * Ficha por una persona. La pantalla manda la ubicación que mide el aparato;
   * si no la tiene, va null y Ritmo decide según la regla de la empresa.
   */
  @Post('fichar')
  fichar(@Body() dto: FicharKioscoDto) {
    return this.kiosco.fichar(dto);
  }
}
