import { registerAs } from '@nestjs/config';

const lista = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((x) => x.replace(/\D/g, ''))
    .filter(Boolean);

/**
 * Registro de productos que las chicas anotan desde Ritmo: aviso por
 * WhatsApp (encuesta en el grupo de Pistech, por el bot de Costear) y
 * confirmación sola pasado un rato.
 */
export default registerAs('stock', () => ({
  /** Bot de WhatsApp de Costear (su servidor de control) y la clave de socio. */
  botUrl: (process.env.BOT_CONTROL_URL ?? '').replace(/\/$/, ''),
  botSecret: process.env.BOT_PARTNER_SECRET ?? '',
  /** Chat al que va el aviso: jid del grupo (…@g.us) o un teléfono. */
  chat: process.env.STOCK_WHATSAPP_CHAT ?? '',
  /** Teléfonos (sólo dígitos) cuyos votos cuentan. */
  votantes: lista(process.env.STOCK_VOTANTES),
  /** Con esto se identifica el bot cuando avisa un voto. */
  callbackSecret: process.env.STOCK_POLL_CALLBACK_SECRET ?? '',
  /** URL pública de este backend, para que el bot avise los votos. */
  publicUrl: (
    process.env.PUBLIC_API_URL ??
    'https://mery-garcia-backend-production.up.railway.app'
  ).replace(/\/$/, ''),
  /** Minutos hasta que un registro sin anular se confirma solo. */
  autoconfirmaMin: Number(process.env.STOCK_AUTOCONFIRMA_MIN) || 60,
}));
