/**
 * Genera y publica una semana de turnos en Ritmo desde el patrón fijo del
 * equipo. El cron lo hace solo los domingos; esto es para arrancar o para
 * rehacer una semana puntual.
 *
 * Uso:
 *   pnpm run turnos:ritmo              → la semana que viene
 *   pnpm run turnos:ritmo 2026-09-14   → esa semana (tiene que ser lunes)
 */
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });

import { RitmoService } from '../src/ritmo/ritmo.service';
import { TurnosService } from '../src/ritmo/turnos/turnos.service';
import { diaIso, lunesDeLaSemanaQueViene } from '../src/ritmo/turnos/fechas';

async function main(): Promise<void> {
  const semana = process.argv[2] ?? lunesDeLaSemanaQueViene();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) {
    throw new Error(`Fecha inválida: ${semana}. Se espera YYYY-MM-DD.`);
  }
  if (diaIso(semana) !== 1) {
    throw new Error(`${semana} no es lunes. La semana de Ritmo arranca el lunes.`);
  }

  const configService = new ConfigService({
    ritmo: {
      baseUrl: process.env.RITMO_BASE_URL,
      apiKey: process.env.RITMO_API_KEY,
    },
  });

  const turnos = new TurnosService(new RitmoService(configService));
  const resumen = await turnos.generarSemana(semana);

  console.log(`\nSemana del ${resumen.weekStart}`);
  console.log(`  creados    : ${resumen.creados}`);
  console.log(`  ya estaban : ${resumen.yaEstaban}`);
  console.log(`  publicados : ${resumen.publicados}`);
  if (resumen.sinResolver.length) {
    console.log(`  SIN RESOLVER (no existen en Ritmo): ${resumen.sinResolver.join(', ')}`);
  }
  console.log();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
