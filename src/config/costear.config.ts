import { registerAs } from '@nestjs/config';

/**
 * Integración con Costear (finanzas de Mery):
 * - Costear lee los totales de caja por medio de pago (server-to-server,
 *   secret compartido en `X-Costear-Secret`).
 * - Los comprobantes de compras se le mandan a Costear para que los concilie
 *   con el banco (`COSTEAR_API_URL` + `COSTEAR_COMPROBANTES_SECRET`). Sin esas
 *   dos variables no se manda nada.
 */
export default registerAs('costear', () => ({
  syncSecret: process.env.COSTEAR_SYNC_SECRET ?? '',
  apiUrl: (process.env.COSTEAR_API_URL ?? '').replace(/\/+$/, ''),
  comprobantesSecret: process.env.COSTEAR_COMPROBANTES_SECRET ?? '',
}));
