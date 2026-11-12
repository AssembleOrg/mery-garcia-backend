/**
 * Arranque real de ConfigWhatsappService contra una base Postgres descartable:
 * la tanda 6 (glosario de recepción) sobre una base como la de producción
 * (versión 5, textos viejos, horario viejo) y sobre una base vacía.
 *
 *   MERY_TEST_POSTGRES_URL=postgres://... pnpm exec jest --config test/jest-whatsapp-e2e.json
 *
 * Sin MERY_TEST_POSTGRES_URL se saltea.
 */
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigWhatsappService } from 'src/whatsapp/config-whatsapp.service';
import { WhatsappConfig } from 'src/whatsapp/entities/WhatsappConfig.entity';
import { WhatsappRespuesta } from 'src/whatsapp/entities/WhatsappRespuesta.entity';
import { RESPUESTAS_SEMILLA } from 'src/whatsapp/respuestas.seed';
import {
  RESPUESTAS_V2,
  RESPUESTAS_V4,
  RESPUESTAS_V5,
} from 'src/whatsapp/respuestas-v2.seed';
import {
  RESPUESTAS_V6,
  TEXTOS_ANTERIORES_V6,
} from 'src/whatsapp/respuestas-v6.seed';
import { HORARIO_ESTUDIO } from 'src/whatsapp/tanda-glosario';

const URL = process.env.MERY_TEST_POSTGRES_URL;
const ANTES_V6 = [
  ...RESPUESTAS_SEMILLA,
  ...RESPUESTAS_V2,
  ...RESPUESTAS_V4,
  ...RESPUESTAS_V5,
];

(URL ? describe : describe.skip)('tanda 6 del bot (e2e)', () => {
  let ds: DataSource;
  let respuestas: Repository<WhatsappRespuesta>;
  let config: Repository<WhatsappConfig>;

  async function arrancar(): Promise<ConfigWhatsappService> {
    const mod = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: URL,
          entities: [WhatsappConfig, WhatsappRespuesta],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([WhatsappConfig, WhatsappRespuesta]),
      ],
      providers: [ConfigWhatsappService],
    }).compile();
    const servicio = mod.get(ConfigWhatsappService);
    await servicio.onModuleInit();
    ds = mod.get(DataSource);
    respuestas = ds.getRepository(WhatsappRespuesta);
    config = ds.getRepository(WhatsappConfig);
    return servicio;
  }

  async function vaciar(): Promise<void> {
    if (!ds) await arrancar();
    await respuestas.clear();
    await config.clear();
  }

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('base como la de producción: corrige las que nadie tocó, respeta la editada, suma las nuevas y el horario', async () => {
    await vaciar();
    await config.save(
      config.create({
        id: 'default',
        botActivo: true,
        horario: { dias: [1, 2, 3, 4, 5, 6], desde: '10:00', hasta: '19:00' },
        mensajes: {} as WhatsappConfig['mensajes'],
        semillaVersion: 5,
      }),
    );
    await respuestas.save(
      ANTES_V6.map((s, i) =>
        respuestas.create({
          ...s,
          // Como estaban en producción antes de la tanda 6.
          respuesta:
            s.clave === 'UBICACION'
              ? 'Texto que Mery editó desde el panel'
              : (TEXTOS_ANTERIORES_V6[s.clave] ?? s.respuesta),
          derivaAPersona: Boolean(s.derivaAPersona),
          activa: true,
          orden: i,
        }),
      ),
    );

    await arrancar();

    const filas = await respuestas.find();
    const por = new Map(filas.map((r) => [r.clave, r]));
    expect(filas).toHaveLength(ANTES_V6.length + RESPUESTAS_V6.length);
    for (const s of RESPUESTAS_V6) expect(por.get(s.clave)?.activa).toBe(true);
    expect(por.get('SENA')!.respuesta).toContain('no es reembolsable');
    expect(por.get('NANOBLADING_QUIERO')!.respuesta).toContain(
      '{dias:nanoblading [consulta obligatoria] sin}',
    );
    expect(por.get('HORARIOS')!.respuesta).toContain('hasta las 16 hs');
    expect(por.get('UBICACION')!.respuesta).toBe(
      'Texto que Mery editó desde el panel',
    );
    const cfg = await config.findOneByOrFail({ id: 'default' });
    expect(cfg.semillaVersion).toBe(6);
    expect(cfg.horario).toEqual(HORARIO_ESTUDIO);

    // Un segundo arranque no cambia nada.
    const antes = JSON.stringify(
      (await respuestas.find({ order: { clave: 'ASC' } })).map((r) => [
        r.clave,
        r.respuesta,
      ]),
    );
    await arrancar();
    const despues = JSON.stringify(
      (await respuestas.find({ order: { clave: 'ASC' } })).map((r) => [
        r.clave,
        r.respuesta,
      ]),
    );
    expect(despues).toBe(antes);
  });

  it('horario editado por Mery: no se toca', async () => {
    await vaciar();
    const suyo = { dias: [2, 3, 4, 5, 6], desde: '11:00', hasta: '18:00' };
    await config.save(
      config.create({
        id: 'default',
        botActivo: true,
        horario: suyo,
        mensajes: {} as WhatsappConfig['mensajes'],
        semillaVersion: 5,
      }),
    );
    await arrancar();
    expect((await config.findOneByOrFail({ id: 'default' })).horario).toEqual(
      suyo,
    );
  });

  it('base vacía: carga todas las respuestas ya corregidas y queda en versión 6', async () => {
    await vaciar();
    await arrancar();
    const filas = await respuestas.find();
    expect(filas).toHaveLength(ANTES_V6.length + RESPUESTAS_V6.length);
    expect(filas.find((r) => r.clave === 'SENA')!.respuesta).toContain(
      'no es reembolsable',
    );
    const cfg = await config.findOneByOrFail({ id: 'default' });
    expect(cfg.semillaVersion).toBe(6);
    expect(cfg.horario).toEqual(HORARIO_ESTUDIO);
  });
});
