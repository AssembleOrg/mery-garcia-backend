/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- los cuerpos de supertest son `any`; acá se mira la respuesta tal cual llega */
/**
 * Arranque real del módulo de Ritmo contra una base Postgres descartable:
 * synchronize crea las columnas y la tabla nuevas, y se prueban los
 * endpoints que consume Ritmo y el servicio de administración.
 *
 * Correr con:
 *   MERY_TEST_POSTGRES_URL=postgres://... pnpm exec jest --config test/jest-ritmo-e2e.json
 *
 * Sin esa variable, se saltea: nunca debe apuntar a la base de producción.
 */
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { join } from 'path';
import { DataSource } from 'typeorm';
import ritmoConfig from 'src/config/ritmo.config';
import { RitmoModule } from 'src/ritmo/ritmo.module';
import { RitmoService } from 'src/ritmo/ritmo.service';
import { ServiciosDiaService } from 'src/ritmo/servicios/servicios-dia.service';
import { TransformInterceptor } from 'src/interceptors/transform.interceptor';
import { AllExceptionsFilter } from 'src/errors/all-exceptions.filter';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { CategoriaServicio } from 'src/comanda/entities/categoriaServicio.entity';
import { UnidadNegocio } from 'src/comanda/entities/unidadNegocio.entity';
import {
  ProductoServicio,
  TipoProductoServicio,
} from 'src/comanda/entities/productoServicio.entity';
import {
  Caja,
  Comanda,
  EstadoDeComanda,
  TipoDeComanda,
} from 'src/comanda/entities/Comanda.entity';
import { ItemComanda } from 'src/comanda/entities/ItemComanda.entity';
import { ConfirmacionServiciosDia } from 'src/ritmo/servicios/entities/ConfirmacionServiciosDia.entity';
import { hoyEnEmpresa, sumarDias } from 'src/ritmo/turnos/fechas';
import { ComisionesConfigService } from 'src/comanda/services/comisiones-config.service';

const URL = process.env.MERY_TEST_POSTGRES_URL;
const SECRET = 'rs_prueba_secreto';
const LUNA_RITMO = '7ba83050-9881-4c57-b94d-450721120663';
const ROSARIO_RITMO = '030c0bfb-76a4-4423-8596-02f5c7c8b44e';
const IVONNE_RITMO = 'ea9554f1-86c0-4a8c-87d2-cd42c31bc9e6';
const KARINA_RITMO = 'ebd3beea-7f8f-42ff-a649-3547bef5d4db';

if (!URL || !URL.includes('mery_boot_test')) {
  // Doble candado: sólo corre contra la base descartable.
  describe.skip('servicios del día para Ritmo (e2e)', () =>
    it('salteado: sin MERY_TEST_POSTGRES_URL de prueba', () => {}));
} else {
  describe('servicios del día para Ritmo (e2e)', () => {
    let app: INestApplication;
    let ds: DataSource;
    let luna: Trabajador;
    let rosario: Trabajador;
    let ivonne: Trabajador;
    const hoy = hoyEnEmpresa();
    const ayer = sumarDias(hoy, -1);

    /** Instante dentro de un día AAAA-MM-DD, a las 15:00 de Buenos Aires (UTC-3). */
    const alas15 = (dia: string) => new Date(`${dia}T15:00:00-03:00`);

    beforeAll(async () => {
      process.env.RITMO_RESUMEN_SECRET = SECRET;
      // Arranque dos días atrás: anteayer entra, el día anterior no.
      process.env.RITMO_RESUMEN_DESDE = sumarDias(hoy, -2);
      const modulo = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [ritmoConfig],
          }),
          TypeOrmModule.forRoot({
            type: 'postgres',
            url: URL,
            entities: [join(__dirname, '..', 'src', '**', '*.entity.ts')],
            synchronize: true,
            dropSchema: true,
            logging: false,
          }),
          RitmoModule,
        ],
      })
        .overrideProvider(RitmoService)
        .useValue({
          listarPersonal: () =>
            Promise.resolve({
              people: [
                {
                  id: LUNA_RITMO,
                  fullName: 'Luna García',
                  role: 'EMPLEADO',
                  isActive: true,
                },
                {
                  id: ROSARIO_RITMO,
                  fullName: 'Rosario Nauda',
                  role: 'EMPLEADO',
                  isActive: true,
                },
                {
                  id: IVONNE_RITMO,
                  fullName: 'Ivonne',
                  role: 'EMPLEADO',
                  isActive: true,
                },
                {
                  id: KARINA_RITMO,
                  fullName: 'Karina Navarro',
                  role: 'EMPLEADO',
                  isActive: true,
                },
              ],
            }),
        })
        .compile();

      app = modulo.createNestApplication();
      app.setGlobalPrefix('api');
      app.useGlobalFilters(new AllExceptionsFilter());
      app.useGlobalInterceptors(new TransformInterceptor());
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
          exceptionFactory: (errors) => new BadRequestException(errors),
        }),
      );
      await app.init();
      ds = app.get(DataSource);

      // --- semilla ---
      const unidad = await ds
        .getRepository(UnidadNegocio)
        .save({ nombre: 'Estilismo' });
      const cats = ds.getRepository(CategoriaServicio);
      const catA = await cats.save({ nombre: 'Categoría A', orden: 1 });
      const catB = await cats.save({ nombre: 'Categoría B', orden: 2 });
      await cats.save({ nombre: 'Categoría C', orden: 3 });

      const productos = ds.getRepository(ProductoServicio);
      const laminado = await productos.save({
        nombre: 'Laminado',
        precio: 45000,
        tipo: TipoProductoServicio.SERVICIO,
        unidadNegocio: unidad,
        categoria: catA,
      });
      const tinte = await productos.save({
        nombre: 'Tinte de cejas',
        precio: 20000,
        tipo: TipoProductoServicio.SERVICIO,
        unidadNegocio: unidad,
        categoria: catB,
      });
      const suelto = await productos.save({
        nombre: 'Servicio sin categoría',
        precio: 10000,
        tipo: TipoProductoServicio.SERVICIO,
        unidadNegocio: unidad,
        categoria: null,
      });
      const crema = await productos.save({
        nombre: 'Crema',
        precio: 5000,
        tipo: TipoProductoServicio.PRODUCTO,
        unidadNegocio: unidad,
      });

      const trabajadores = ds.getRepository(Trabajador);
      luna = await trabajadores.save({
        nombre: 'Luna',
        ritmoUserId: LUNA_RITMO,
      });
      rosario = await trabajadores.save({ nombre: 'Rosario' }); // sin vincular: va por nombre
      ivonne = await trabajadores.save({
        nombre: 'Ivonne',
        ritmoUserId: IVONNE_RITMO,
        ritmoConfirmaServicios: false,
      });
      const admin = await ds.getRepository(Personal).save({
        nombre: 'Admin',
        email: 'admin@test',
        password: 'x',
        fechaIngreso: new Date(),
      });

      const comandas = ds.getRepository(Comanda);
      const items = ds.getRepository(ItemComanda);
      const comanda = async (
        estado: EstadoDeComanda,
        dia: string,
        numero: string,
        tipo = TipoDeComanda.INGRESO,
      ) =>
        comandas.save({
          numero,
          caja: Caja.CAJA_1,
          tipoDeComanda: tipo,
          estadoDeComanda: estado,
          creadoPor: admin,
          createdAt: alas15(dia),
          precioDolar: 0,
          precioPesos: 0,
          valorDolar: 0,
        });
      const item = (
        c: Comanda,
        ps: ProductoServicio,
        t: Trabajador,
        cantidad = 1,
      ) =>
        items.save({
          comanda: c,
          productoServicio: ps,
          nombre: ps.nombre,
          precio: ps.precio,
          cantidad,
          trabajador: t,
        });

      const c1 = await comanda(EstadoDeComanda.PENDIENTE, hoy, '01-0001');
      await item(c1, laminado, luna, 2);
      await item(c1, tinte, luna);
      await item(c1, crema, luna); // producto: no cuenta
      await item(c1, laminado, rosario, 3);
      const c2 = await comanda(EstadoDeComanda.VALIDADO, hoy, '01-0002');
      await item(c2, laminado, luna);
      await item(c2, suelto, luna);
      const c3 = await comanda(EstadoDeComanda.CANCELADA, hoy, '01-0003');
      await item(c3, laminado, luna, 5); // cancelada: no cuenta
      const c4 = await comanda(
        EstadoDeComanda.PENDIENTE,
        hoy,
        '01-0004',
        TipoDeComanda.EGRESO,
      );
      await item(c4, laminado, luna, 4); // egreso: no cuenta
      const c5 = await comanda(EstadoDeComanda.TRASPASADA, ayer, '01-0005');
      await item(c5, tinte, luna, 2);
      await item(c5, crema, ivonne); // sólo un producto: estuvo en la comanda
      const c6 = await comanda(EstadoDeComanda.PENDIENTE, hoy, '01-0006');
      const borrado = await item(c6, laminado, luna, 7);
      await items.softRemove(borrado); // ítem borrado: no cuenta
    });

    afterAll(async () => {
      await app?.close();
    });

    const get = (q: Record<string, string>, secret: string | null = SECRET) => {
      const r = request(app.getHttpServer())
        .get('/api/integraciones/ritmo/resumen')
        .query(q);
      return secret ? r.set('X-Ritmo-Secret', secret) : r;
    };
    const post = (body: object, secret: string | null = SECRET) => {
      const r = request(app.getHttpServer())
        .post('/api/integraciones/ritmo/resumen')
        .send(body);
      return secret ? r.set('X-Ritmo-Secret', secret) : r;
    };

    it('synchronize creó las columnas y la tabla nuevas', async () => {
      const cols = await ds.query(
        `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'trabajadores' AND column_name IN ('ritmoUserId', 'ritmoConfirmaServicios') ORDER BY column_name`,
      );
      expect(cols).toEqual([
        {
          column_name: 'ritmoConfirmaServicios',
          data_type: 'boolean',
          column_default: 'true',
        },
        { column_name: 'ritmoUserId', data_type: 'uuid', column_default: null },
      ]);
      const tabla = await ds.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'ritmo_confirmacion_servicios' ORDER BY indexname`,
      );
      expect(tabla.map((t: { indexname: string }) => t.indexname)).toContain(
        'uq_confirmacion_servicios_dia',
      );
      const idx = await ds.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_trabajador_ritmo_user'`,
      );
      expect(idx[0].indexdef).toMatch(/UNIQUE/);
      expect(idx[0].indexdef).toMatch(/IS NOT NULL/);
    });

    it('sin secreto o con otro secreto no entra', async () => {
      expect((await get({ userId: LUNA_RITMO, day: hoy }, null)).status).toBe(
        401,
      );
      expect(
        (await get({ userId: LUNA_RITMO, day: hoy }, 'rs_otro')).status,
      ).toBe(401);
      expect(
        (await post({ userId: LUNA_RITMO, day: hoy, agreed: true }, null))
          .status,
      ).toBe(401);
    });

    it('cuenta los servicios de hoy de Luna por categoría, validados o no', async () => {
      const r = await get({ userId: LUNA_RITMO, day: hoy });
      expect(r.status).toBe(200);
      const d = r.body.data;
      expect(d.available).toBe(true);
      expect(d.day).toBe(hoy);
      expect(d.title).toBe('Servicios del día');
      expect(d.items).toEqual([
        {
          key: expect.any(String),
          label: 'Categoría A',
          count: 3,
          detail: '1 validada',
        },
        {
          key: expect.any(String),
          label: 'Categoría B',
          count: 1,
          detail: 'sin validar',
        },
        { key: expect.any(String), label: 'Categoría C', count: 0, detail: '' },
        {
          key: 'sin-categoria',
          label: 'Sin categoría',
          count: 1,
          detail: 'validada',
        },
      ]);
      expect(d.total).toBe(5);
      // c1 y c2: la cancelada, el egreso y la del ítem borrado no cuentan.
      expect(d.highlights).toEqual([
        { key: 'comandas', label: 'comandas', count: 2 },
      ]);
      expect(d.confirmation).toEqual({
        required: true,
        confirmedAt: null,
        agreed: null,
        note: null,
      });
    });

    it('otro día trae sólo lo de ese día', async () => {
      const r = await get({ userId: LUNA_RITMO, day: ayer });
      expect(
        r.body.data.items.find(
          (i: { label: string }) => i.label === 'Categoría B',
        ).count,
      ).toBe(2);
      expect(r.body.data.total).toBe(2);
      expect(r.body.data.highlights[0]).toEqual({
        key: 'comandas',
        label: 'comanda',
        count: 1,
      });
    });

    it('Rosario sin ritmoUserId se resuelve por nombre; Ivonne confirma sólo si tuvo comandas; Karina no tiene nada', async () => {
      const ro = await get({ userId: ROSARIO_RITMO, day: hoy });
      expect(ro.body.data.total).toBe(3);
      expect(ro.body.data.confirmation.required).toBe(true);
      const iv = await get({ userId: IVONNE_RITMO, day: hoy });
      expect(iv.body.data.available).toBe(true);
      expect(iv.body.data.total).toBe(0);
      expect(iv.body.data.highlights[0].count).toBe(0);
      expect(iv.body.data.confirmation.required).toBe(false);
      // El día que figura en una comanda (aunque sea por un producto) confirma.
      const ivAyer = await get({ userId: IVONNE_RITMO, day: ayer });
      expect(ivAyer.body.data.total).toBe(0);
      expect(ivAyer.body.data.highlights[0].count).toBe(1);
      expect(ivAyer.body.data.confirmation.required).toBe(true);
      const ka = await get({ userId: KARINA_RITMO, day: hoy });
      expect(ka.status).toBe(200);
      expect(ka.body.data).toEqual({ available: false, day: hoy });
    });

    it('antes del día de arranque no muestra nada ni deja confirmar', async () => {
      const antes = sumarDias(hoy, -3);
      const r = await get({ userId: LUNA_RITMO, day: antes });
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({ available: false, day: antes });
      const c = await post({ userId: LUNA_RITMO, day: antes, agreed: true });
      expect(c.status).toBe(400);
      expect(c.body.message).toMatch(/arranca el/);
    });

    it('rechaza pedidos mal armados', async () => {
      expect((await get({ userId: 'x', day: hoy })).status).toBe(400);
      expect(
        (await get({ userId: LUNA_RITMO, day: '19/10/2026' })).status,
      ).toBe(400);
      expect(
        (await get({ userId: LUNA_RITMO, day: '2026-02-30' })).status,
      ).toBe(400);
      expect(
        (await post({ userId: LUNA_RITMO, day: hoy, agreed: 'si' })).status,
      ).toBe(400);
      expect(
        (
          await post({
            userId: LUNA_RITMO,
            day: sumarDias(hoy, 1),
            agreed: true,
          })
        ).status,
      ).toBe(400);
      const sinNota = await post({
        userId: LUNA_RITMO,
        day: hoy,
        agreed: false,
      });
      expect(sinNota.status).toBe(400);
      expect(sinNota.body.message).toMatch(/hace falta decir/);
      expect(
        (await post({ userId: KARINA_RITMO, day: hoy, agreed: true })).status,
      ).toBe(404);
    });

    it('la confirmación se guarda con el resumen visto y la última pisa a la anterior', async () => {
      const no = await post({
        userId: LUNA_RITMO,
        day: hoy,
        agreed: false,
        note: 'Hice 4 de A',
        punchId: '11111111-1111-4111-8111-111111111111',
      });
      expect(no.status).toBe(200);
      expect(no.body.data.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      let r = await get({ userId: LUNA_RITMO, day: hoy });
      expect(r.body.data.confirmation).toEqual({
        required: true,
        confirmedAt: no.body.data.confirmedAt,
        agreed: false,
        note: 'Hice 4 de A',
      });

      const si = await post({ userId: LUNA_RITMO, day: hoy, agreed: true });
      expect(si.status).toBe(200);
      r = await get({ userId: LUNA_RITMO, day: hoy });
      expect(r.body.data.confirmation.agreed).toBe(true);
      expect(r.body.data.confirmation.note).toBeNull();

      const filas = await ds.getRepository(ConfirmacionServiciosDia).find();
      expect(filas).toHaveLength(1);
      expect(filas[0].trabajadorId).toBe(luna.id);
      expect(filas[0].ritmoPunchId).toBeNull();
      expect(filas[0].comandas).toBe(2);
      expect(
        filas[0].resumen.map((l) => [l.label, l.count, l.validadas]),
      ).toEqual([
        ['Categoría A', 3, 1],
        ['Categoría B', 1, 0],
        ['Categoría C', 0, 0],
        ['Sin categoría', 1, 1],
      ]);
    });

    it('administración: listado por día, vínculos y vincular', async () => {
      const servicios = app.get(ServiciosDiaService);
      const lista = await servicios.listar(ayer, hoy);
      expect(
        lista.map((d) => [
          d.dia,
          d.nombre,
          d.comandas,
          d.total,
          d.confirmacion?.conforme ?? null,
        ]),
      ).toEqual([
        [ayer, 'Ivonne', 1, 0, null],
        [ayer, 'Luna', 1, 2, null],
        [hoy, 'Luna', 2, 5, true],
        [hoy, 'Rosario', 1, 3, null],
      ]);
      await expect(servicios.listar(hoy, ayer)).rejects.toThrow('anterior');

      const vinculos = await servicios.vinculos();
      const ro = vinculos.find((v) => v.nombre === 'Rosario');
      expect(ro?.ritmoUserId).toBeNull();
      expect(ro?.sugerencia).toEqual({
        id: ROSARIO_RITMO,
        fullName: 'Rosario Nauda',
      });
      expect(
        vinculos.find((v) => v.nombre === 'Ivonne')?.ritmoConfirmaServicios,
      ).toBe(false);

      await expect(
        servicios.vincular(rosario.id, { ritmoUserId: LUNA_RITMO }),
      ).rejects.toThrow(/ya está vinculada a Luna/);
      const v = await servicios.vincular(rosario.id, {
        ritmoUserId: ROSARIO_RITMO,
        ritmoConfirmaServicios: false,
      });
      expect(v.ritmoUserId).toBe(ROSARIO_RITMO);
      expect(v.sugerencia).toBeNull();
      // Desmarcada, pero hoy está en una comanda: igual confirma.
      const r = await get({ userId: ROSARIO_RITMO, day: hoy });
      expect(r.body.data.confirmation.required).toBe(true);
      const sinNada = await get({
        userId: ROSARIO_RITMO,
        day: sumarDias(ayer, -1),
      });
      expect(sinNada.body.data.confirmation.required).toBe(false);
      expect(ivonne.id).toBeTruthy();
    });

    it('listado de servicios uno por uno; la plata solo con esquema por base fija', async () => {
      // Sin esquema (cálculo histórico): listado sin montos ni "earnings".
      const antes = (await get({ userId: LUNA_RITMO, day: hoy })).body.data;
      expect(antes.earnings).toBeNull();
      const servicios = antes.sections.find((x: any) => x.key === 'servicios');
      expect(servicios.lines.map((l: any) => l.label).sort()).toEqual(
        [
          'Laminado',
          'Laminado ×2',
          'Servicio sin categoría',
          'Tinte de cejas',
        ].sort(),
      );
      expect(servicios.lines.every((l: any) => l.amount === null)).toBe(true);
      const tinte = servicios.lines.find(
        (l: any) => l.label === 'Tinte de cejas',
      );
      expect(tinte).toMatchObject({
        detail: 'Categoría B · 15:00',
        badge: 'sin validar',
      });
      expect(
        antes.sections.find((x: any) => x.key === 'productos').lines[0].label,
      ).toBe('Crema');

      // Con esquema: 30–35% (sin confirmar), A $40.000, B $30.000, productos 5%.
      const cats = await ds.getRepository(CategoriaServicio).find();
      const id = (n: string) => cats.find((c) => c.nombre === n)!.id;
      await app
        .get(ComisionesConfigService, { strict: false })
        .actualizarEsquema(luna.id, {
          porcentajeMin: 30,
          porcentajeMax: 35,
          productosPorcentaje: 5,
          baseDesde: sumarDias(hoy, -10),
          bases: [
            { categoriaId: id('Categoría A'), montoBase: 40000 },
            { categoriaId: id('Categoría B'), montoBase: 30000 },
          ],
        } as never);
      const d = (await get({ userId: LUNA_RITMO, day: hoy })).body.data;
      // 3 laminados × 40.000 × 30% + tinte 30.000 × 30% + crema 5.000 × 5%.
      expect(d.earnings.amounts).toEqual([{ currency: 'ARS', value: 45250 }]);
      expect(d.earnings.detail).toBe(
        'Calculada al 30%: el % del mes se confirma al cierre. Al máximo serían $ 52.750.',
      );
      const s2 = d.sections.find((x: any) => x.key === 'servicios').lines;
      expect(s2.find((l: any) => l.label === 'Laminado ×2')).toMatchObject({
        amount: { currency: 'ARS', value: 24000 },
        amountDetail: '$ 80.000 × 30%',
      });
      expect(
        s2.find((l: any) => l.label === 'Servicio sin categoría'),
      ).toMatchObject({
        amount: null,
        amountDetail: 'sin base cargada',
      });
      // El resumen por categoría sigue viniendo igual.
      expect(d.items.find((i: any) => i.label === 'Categoría A').count).toBe(3);
    });
  });
}
