import { registerAs } from '@nestjs/config';

/**
 * WhatsApp: el sidecar (neonize) que habla con WhatsApp y el modelo que
 * clasifica la intención de cada mensaje. El modelo nunca escribe hacia la
 * clienta: sólo elige una respuesta de la tabla.
 */
export default registerAs('whatsapp', () => ({
  sidecarUrl: (process.env.WHATSAPP_SIDECAR_URL ?? '').replace(/\/$/, ''),
  sidecarSecret: process.env.WHATSAPP_SIDECAR_SECRET ?? '',
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY ?? '',
    baseUrl: (
      process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.io/anthropic/v1'
    ).replace(/\/$/, ''),
    model: process.env.MINIMAX_MODEL ?? 'MiniMax-M3',
    timeoutMs: Number(process.env.MINIMAX_TIMEOUT_MS ?? 15_000),
  },
  /**
   * Fuentes de datos en vivo para las respuestas ({formaciones}, {servicios:…}).
   * Son las APIs públicas del portal de formaciones y de la web de turnos.
   */
  fuentes: {
    catalogoFormacionesUrl:
      process.env.WHATSAPP_CATALOGO_FORMACIONES_URL ??
      'https://mery-portal-backend-production.up.railway.app/api/public/catalog',
    serviciosTurnosUrl:
      process.env.WHATSAPP_SERVICIOS_TURNOS_URL ??
      'https://mery-booking-backend-production.up.railway.app/api/services/visible/all',
  },
  /**
   * Central de chatbots (console-central). Opcional: sin estas tres variables
   * el bot funciona igual que siempre y no le reporta nada a nadie.
   */
  central: {
    url: (process.env.CENTRAL_URL ?? '').replace(/\/$/, ''),
    botId: process.env.CENTRAL_BOT_ID ?? '',
    token: process.env.CENTRAL_BOT_TOKEN ?? '',
  },
}));
