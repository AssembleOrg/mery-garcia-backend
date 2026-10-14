import { registerAs } from '@nestjs/config';

/**
 * Integración con Costear (finanzas de Mery): Costear lee los totales de caja
 * por medio de pago. Llamada server-to-server, autenticada por un secret
 * compartido en `X-Costear-Secret`.
 */
export default registerAs('costear', () => ({
  syncSecret: process.env.COSTEAR_SYNC_SECRET ?? '',
}));
