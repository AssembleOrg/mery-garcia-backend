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
}));
