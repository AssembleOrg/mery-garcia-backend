import { registerAs } from '@nestjs/config';

/**
 * Claude (Anthropic) para leer comandas en papel. Sin clave, la lectura con IA
 * queda deshabilitada y el resto del sistema funciona igual.
 */
export default registerAs('anthropic', () => ({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  /** Elegido por la prueba con 40 comandas reales (lee como Opus a menos de la mitad del costo). */
  modeloComandas: process.env.ANTHROPIC_MODEL_COMANDAS ?? 'claude-sonnet-5-5',
}));
