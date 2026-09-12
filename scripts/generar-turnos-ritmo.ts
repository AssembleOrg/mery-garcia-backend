/**
 * Genera y publica una semana de turnos desde el patrón. El cron del domingo
 * lo hace solo; esto es para arrancar o para rehacer una semana puntual.
 *
 * Le pega al backend en vez de levantar Nest: así no abre una conexión con
 * synchronize contra la base de producción sólo para correr un script.
 *
 * Uso:
 *   pnpm run turnos:ritmo              → la semana que viene
 *   pnpm run turnos:ritmo 2026-09-28   → esa semana (tiene que ser lunes)
 *
 * Con API_URL=http://localhost:3000 apunta al backend local.
 */
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });

import { diaIso, lunesDeLaSemanaQueViene } from '../src/ritmo/turnos/fechas';

const API_URL =
  process.env.API_URL ?? 'https://mery-garcia-backend-production.up.railway.app';

async function main(): Promise<void> {
  const semana = process.argv[2] ?? lunesDeLaSemanaQueViene();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana)) {
    throw new Error(`Fecha inválida: ${semana}. Se espera YYYY-MM-DD.`);
  }
  if (diaIso(semana) !== 1) {
    throw new Error(`${semana} no es lunes. La semana de Ritmo arranca el lunes.`);
  }

  const res = await fetch(`${API_URL}/api/ritmo/horarios/generar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ weekStart: semana }),
  });

  const cuerpo = await res.json();
  if (!res.ok) {
    throw new Error(`${res.status}: ${cuerpo?.message ?? JSON.stringify(cuerpo)}`);
  }

  const resumen = cuerpo.data ?? cuerpo;
  console.log(`\nSemana del ${resumen.weekStart}`);
  console.log(`  creados    : ${resumen.creados}`);
  console.log(`  ya estaban : ${resumen.yaEstaban}`);
  console.log(`  publicados : ${resumen.publicados}`);
  if (resumen.sinResolver?.length) {
    console.log(`  SIN RESOLVER: ${resumen.sinResolver.join(', ')}`);
  }
  console.log();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
