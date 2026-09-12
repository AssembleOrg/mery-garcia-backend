import { registerAs } from '@nestjs/config';

export default registerAs('ritmo', () => ({
  baseUrl:
    process.env.RITMO_BASE_URL ||
    'https://ritmo-production-2c5a.up.railway.app',
  apiKey: process.env.RITMO_API_KEY,
  webhookSecret: process.env.RITMO_WEBHOOK_SECRET,
}));
