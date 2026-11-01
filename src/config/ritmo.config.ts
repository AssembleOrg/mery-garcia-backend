import { registerAs } from '@nestjs/config';

export default registerAs('ritmo', () => ({
  baseUrl:
    process.env.RITMO_BASE_URL ||
    'https://ritmo-production-2c5a.up.railway.app',
  apiKey: process.env.RITMO_API_KEY,
  webhookSecret: process.env.RITMO_WEBHOOK_SECRET,
  /**
   * Secreto con el que Ritmo se identifica cuando pregunta por los servicios
   * del día de una persona (`X-Ritmo-Secret`). Lo genera Ritmo al conectar la
   * fuente (Configuración → Integraciones → Resumen de jornada).
   */
  resumenSecret: process.env.RITMO_RESUMEN_SECRET ?? '',
  /**
   * Primer día (AAAA-MM-DD) que se le muestra y se le pide confirmar a cada
   * una en Ritmo. Lo anterior no se reabre: arrancó con noviembre 2026.
   */
  resumenDesde: process.env.RITMO_RESUMEN_DESDE || '2026-11-01',
}));
