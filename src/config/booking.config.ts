import { registerAs } from '@nestjs/config';

/**
 * Integración con el sistema de turnos (booking). Cuando una reserva se paga
 * por Mercado Pago, booking avisa a este sistema y la seña entra sola. La
 * llamada es server-to-server, autenticada por un secret compartido.
 */
export default registerAs('booking', () => ({
  syncSecret: process.env.BOOKING_SYNC_SECRET ?? '',
  /** API pública del sistema de turnos, para leer la lista de servicios. */
  apiUrl: (
    process.env.BOOKING_API_URL ?? 'https://mery-booking-backend-production.up.railway.app'
  ).replace(/\/$/, ''),
}));
