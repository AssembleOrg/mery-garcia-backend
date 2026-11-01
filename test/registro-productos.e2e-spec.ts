/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- los cuerpos de supertest son `any`; acá se mira la respuesta tal cual llega */
/**
 * Registro de productos desde Ritmo contra una base Postgres descartable y
 * un bot de WhatsApp falso: alta, búsqueda, encuesta al grupo, votos
 * (autorizados o no), cancelación y confirmación sola a la hora.
 *
 * Correr con:
 *   MERY_TEST_POSTGRES_URL=postgres://.../mery_boot_test pnpm exec jest --config test/jest-ritmo-e2e.json
 */
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'path';
import { DataSource } from 'typeorm';
import ritmoConfig from 'src/config/ritmo.config';
import stockConfig from 'src/config/stock.config';
import { TransformInterceptor } from 'src/interceptors/transform.interceptor';
import { AllExceptionsFilter } from 'src/errors/all-exceptions.filter';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { ProductoStock } from 'src/stock/entities/ProductoStock.entity';
import {
  EstadoSolicitudStock,
  OrigenSolicitudStock,
  SolicitudStock,
  SolicitudStockItem,
} from 'src/stock/entities/SolicitudStock.entity';
import { SolicitudesStockService } from 'src/stock/solicitudes-stock.service';
import { RegistroRitmoService } from 'src/stock/registro-ritmo.service';
import { RegistroRitmoController } from 'src/stock/registro-ritmo.controller';
import { AvisoWhatsappStockService } from 'src/stock/aviso-whatsapp-stock.service';
import { VotosWhatsappController } from 'src/stock/votos-whatsapp.controller';
import { AccesosEmpleadoService } from 'src/stock/accesos-empleado.service';
import { NotificacionesService } from 'src/whatsapp/notificaciones.service';
import { PushService } from 'src/push/push.service';
import { hoyEnEmpresa } from 'src/ritmo/turnos/fechas';

const URL = process.env.MERY_TEST_POSTGRES_URL;
const SECRET_RITMO = 'rs_prueba_secreto';
const SECRET_SOCIO = 'socio_mery_prueba';
const SECRET_VOTOS = 'votos_prueba';
const LUNA_RITMO = '7ba83050-9881-4c57-b94d-450721120663';
const ROSARIO_RITMO = '030c0bfb-76a4-4423-8596-02f5c7c8b44e';
const CHARLY = '5491155556666';
const GRUPO = '120363000000000000@g.us';

if (!URL || !URL.includes('mery_boot_test')) {
  describe.skip('registro de productos desde Ritmo (e2e)', () =>
    it('salteado: sin MERY_TEST_POSTGRES_URL de prueba', () => {}));
} else {
  describe('registro de productos desde Ritmo (e2e)', () => {
    let app: INestApplication;
    let ds: DataSource;
    let bot: Server;
    let botResponde = 200;
    const encuestas: { secret: string; body: any }[] = [];
    let luna: Trabajador;
    let shampoo: ProductoStock;
    const hoy = hoyEnEmpresa();

    beforeAll(async () => {
      // Bot falso: guarda lo que le llega a /poll y devuelve un id.
      bot = createServer((req, res) => {
        let crudo = '';
        req.on('data', (c) => (crudo += c));
        req.on('end', () => {
          encuestas.push({
            secret: String(req.headers['x-bot-secret'] ?? ''),
            body: JSON.parse(crudo || '{}'),
          });
          res.writeHead(botResponde, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify(
              botResponde === 200
                ? { ok: true, messageId: `3EB0${encuestas.length}` }
                : { error: 'bot no conectado' },
            ),
          );
        });
      });
      await new Promise<void>((ok) => bot.listen(0, '127.0.0.1', ok));
      const puerto = (bot.address() as AddressInfo).port;

      Object.assign(process.env, {
        RITMO_RESUMEN_SECRET: SECRET_RITMO,
        BOT_CONTROL_URL: `http://127.0.0.1:${puerto}/`,
        BOT_PARTNER_SECRET: SECRET_SOCIO,
        STOCK_WHATSAPP_CHAT: GRUPO,
        STOCK_VOTANTES: `+54 9 11 5555-6666`,
        STOCK_POLL_CALLBACK_SECRET: SECRET_VOTOS,
        PUBLIC_API_URL: 'https://mery.test',
      });

      const modulo = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [ritmoConfig, stockConfig],
          }),
          TypeOrmModule.forRoot({
            type: 'postgres',
            url: URL,
            entities: [join(__dirname, '..', 'src', '**', '*.entity.ts')],
            synchronize: true,
            dropSchema: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([
            ProductoStock,
            SolicitudStock,
            SolicitudStockItem,
            Trabajador,
            Personal,
          ]),
        ],
        controllers: [RegistroRitmoController, VotosWhatsappController],
        providers: [
          SolicitudesStockService,
          RegistroRitmoService,
          AvisoWhatsappStockService,
          AccesosEmpleadoService,
          {
            provide: NotificacionesService,
            useValue: { crear: () => Promise.resolve() },
          },
          {
            provide: PushService,
            useValue: {
              enviarARoles: () => Promise.resolve(),
              enviarA: () => Promise.resolve(),
            },
          },
        ],
      }).compile();

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

      const productos = ds.getRepository(ProductoStock);
      shampoo = await productos.save({ nombre: 'Shampoo neutro' });
      await productos.save({ nombre: 'Crema ácida' });
      await productos.save({ nombre: 'Ácido hialurónico' });
      const trabajadores = ds.getRepository(Trabajador);
      luna = await trabajadores.save({
        nombre: 'Luna',
        ritmoUserId: LUNA_RITMO,
      });
      await trabajadores.save({
        nombre: 'Rosario',
        ritmoUserId: ROSARIO_RITMO,
      });
      await ds
        .createQueryBuilder()
        .relation(ProductoStock, 'trabajadores')
        .of(shampoo)
        .add(luna);
    });

    afterAll(async () => {
      await app?.close();
      await new Promise((ok) => bot?.close(ok));
    });

    const leer = (
      q: Record<string, string>,
      secret: string | null = SECRET_RITMO,
    ) => {
      const r = request(app.getHttpServer())
        .get('/api/integraciones/ritmo/productos')
        .query(q);
      return secret ? r.set('X-Ritmo-Secret', secret) : r;
    };
    const mandar = (body: object, secret: string | null = SECRET_RITMO) => {
      const r = request(app.getHttpServer())
        .post('/api/integraciones/ritmo/productos')
        .send(body);
      return secret ? r.set('X-Ritmo-Secret', secret) : r;
    };
    const votar = (body: object, secret: string | null = SECRET_VOTOS) => {
      const r = request(app.getHttpServer())
        .post('/api/integraciones/whatsapp/votos')
        .send(body);
      return secret ? r.set('X-Bot-Secret', secret) : r;
    };
    const estado = async (id: string) =>
      await ds.getRepository(SolicitudStock).findOneByOrFail({ id });
    /** El aviso sale sin hacer esperar a Ritmo: se espera a que llegue. */
    const esperarEncuesta = async (cuantas: number) => {
      for (let i = 0; i < 50 && encuestas.length < cuantas; i++)
        await new Promise((ok) => setTimeout(ok, 50));
      expect(encuestas).toHaveLength(cuantas);
    };
    const anotar = (items: object[], nota: string | null = null) =>
      mandar({ userId: LUNA_RITMO, action: 'create', items, note: nota });

    it('sin el secreto de Ritmo no entra', async () => {
      expect((await leer({ userId: LUNA_RITMO }, null)).status).toBe(401);
      expect((await leer({ userId: LUNA_RITMO }, 'otro')).status).toBe(401);
      expect((await mandar({ userId: LUNA_RITMO }, null)).status).toBe(401);
    });

    it('sin habilitar, Ritmo no muestra nada y no deja anotar', async () => {
      const r = await leer({ userId: LUNA_RITMO, day: hoy });
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({ enabled: false });
      const a = await anotar([{ name: 'Gasa' }]);
      expect(a.status).toBe(400);
      expect(a.body.message).toMatch(/No tenés habilitado/);
    });

    it('habilitada: sugiere lo asignado y busca sin tildes en todo el catálogo', async () => {
      await ds.getRepository(Trabajador).update(luna.id, {
        ritmoRegistraProductos: true,
      });
      const sin = await leer({ userId: LUNA_RITMO, day: hoy });
      expect(sin.body.data).toEqual({
        enabled: true,
        allowFreeText: true,
        products: [{ id: shampoo.id, name: 'Shampoo neutro' }],
        records: [],
      });
      const con = await leer({ userId: LUNA_RITMO, day: hoy, q: 'ACID' });
      expect(
        con.body.data.products.map((p: { name: string }) => p.name),
      ).toEqual(['Ácido hialurónico', 'Crema ácida']);
    });

    it('anota catálogo + texto libre, avisa al grupo con la encuesta y queda pendiente', async () => {
      const r = await anotar(
        [
          { productId: shampoo.id, name: 'shampoo', quantity: 1 },
          { productId: null, name: 'Guantes', quantity: 2 },
          { name: 'guantes' },
        ],
        'clienta de laminado',
      );
      expect(r.status).toBe(200);
      const rec = r.body.data.record;
      expect(rec).toMatchObject({
        note: 'clienta de laminado',
        status: 'PENDING',
        canCancel: true,
      });
      expect(rec.statusLabel).toMatch(
        /^Se confirma sola a las \d\d:\d\d$/,
      );
      expect(rec.items).toEqual(
        expect.arrayContaining([
          { name: 'Shampoo neutro', quantity: 1, freeText: false },
          { name: 'Guantes', quantity: 3, freeText: true },
        ]),
      );

      await esperarEncuesta(1);
      const e = encuestas[0];
      expect(e.secret).toBe(SECRET_SOCIO);
      expect(e.body).toMatchObject({
        chat: GRUPO,
        options: ['✅ Confirmar', '❌ Anular'],
        multiple: false,
        ref: `mery-stock:${rec.id}`,
        callbackUrl: 'https://mery.test/api/integraciones/whatsapp/votos',
        callbackSecret: SECRET_VOTOS,
      });
      expect(e.body.name).toMatch(/^🧴 Luna anotó: /);
      expect(e.body.name).toMatch(/3 Guantes \(libre\)/);
      expect(e.body.name).toMatch(/📝 clienta de laminado$/);

      for (let i = 0; i < 20 && !(await estado(rec.id)).whatsappMensajeId; i++)
        await new Promise((ok) => setTimeout(ok, 50));
      const s = await estado(rec.id);
      expect(s.whatsappMensajeId).toBe('3EB01');
      expect(s.origen).toBe(OrigenSolicitudStock.RITMO);
      expect(s.ritmoUserId).toBe(LUNA_RITMO);
      expect(s.solicitadaPorId).toBeNull();

      const lista = await leer({ userId: LUNA_RITMO, day: hoy });
      expect(lista.body.data.records).toHaveLength(1);
    });

    it('votos: secreto, votante no autorizado, anular, confirmar y sacar el voto', async () => {
      const id = encuestas[0].body.ref.slice('mery-stock:'.length);
      const voto = (phone: string, selected: string[]) =>
        votar({
          ref: `mery-stock:${id}`,
          messageId: '3EB01',
          chat: GRUPO,
          voter: { phone, lid: null, name: 'Charly' },
          selected,
        });

      expect((await votar({ ref: `mery-stock:${id}` }, 'otro')).status).toBe(
        401,
      );

      const ajeno = await voto('5491144443333', ['❌ Anular']);
      expect(ajeno.status).toBe(200);
      expect(ajeno.body.data).toEqual({ reply: null });
      expect((await estado(id)).estado).toBe(EstadoSolicitudStock.PENDIENTE);

      const anula = await voto(CHARLY, ['❌ Anular']);
      expect(anula.body.data).toEqual({
        reply: '🚫 Anulado por Charly (Luna)',
      });
      let s = await estado(id);
      expect(s.estado).toBe(EstadoSolicitudStock.RECHAZADA);
      expect(s.resueltaPorNombre).toBe('Charly (WhatsApp)');

      const vista = await leer({ userId: LUNA_RITMO, day: hoy });
      expect(vista.body.data.records[0]).toMatchObject({
        status: 'VOIDED',
        statusLabel: 'Anulado',
        canCancel: false,
      });

      const confirma = await voto(CHARLY, ['✅ Confirmar']);
      expect(confirma.body.data).toEqual({
        reply: '✔️ Confirmado por Charly (Luna)',
      });
      s = await estado(id);
      expect(s.estado).toBe(EstadoSolicitudStock.APROBADA);

      expect((await voto(CHARLY, [])).body.data).toEqual({ reply: null });
      expect((await estado(id)).estado).toBe(EstadoSolicitudStock.APROBADA);

      // Una encuesta que no es nuestra no hace nada.
      expect(
        (
          await votar({
            ref: 'otra-cosa:1',
            voter: { phone: CHARLY },
            selected: ['✅ Confirmar'],
          })
        ).body.data,
      ).toEqual({ reply: null });
    });

    it('ella cancela lo pendiente; después nadie lo puede revivir', async () => {
      const r = await anotar([{ name: 'Hisopos', quantity: 3 }]);
      const id = r.body.data.record.id;
      await esperarEncuesta(2);

      const ajena = await mandar({
        userId: ROSARIO_RITMO,
        action: 'cancel',
        recordId: id,
      });
      expect(ajena.status).toBe(400); // Rosario no está habilitada

      const c = await mandar({
        userId: LUNA_RITMO,
        action: 'cancel',
        recordId: id,
      });
      expect(c.status).toBe(200);
      expect(c.body.data.record).toMatchObject({
        status: 'CANCELLED',
        statusLabel: 'Cancelado por vos',
        canCancel: false,
      });
      const otra = await mandar({
        userId: LUNA_RITMO,
        action: 'cancel',
        recordId: id,
      });
      expect(otra.status).toBe(409);

      const v = await votar({
        ref: `mery-stock:${id}`,
        voter: { phone: CHARLY, name: 'Charly' },
        selected: ['✅ Confirmar'],
      });
      expect(v.body.data.reply).toMatch(/Ya la había cancelado ella/);
      expect((await estado(id)).estado).toBe(EstadoSolicitudStock.CANCELADA);
    });

    it('si el bot está caído el registro queda igual', async () => {
      botResponde = 503;
      const r = await anotar([{ name: 'Algodón' }]);
      expect(r.status).toBe(200);
      await esperarEncuesta(3);
      await new Promise((ok) => setTimeout(ok, 200));
      const s = await estado(r.body.data.record.id);
      expect(s.estado).toBe(EstadoSolicitudStock.PENDIENTE);
      expect(s.whatsappMensajeId).toBeNull();
      botResponde = 200;
    });

    it('lo que nadie anuló se confirma solo a la hora', async () => {
      const servicio = app.get(SolicitudesStockService);
      expect(await servicio.autoconfirmar(new Date())).toBe(0);
      const enUnaHora = new Date(Date.now() + 61 * 60_000);
      expect(await servicio.autoconfirmar(enUnaHora)).toBe(1); // el de "Algodón"
      const pendientes = await ds
        .getRepository(SolicitudStock)
        .findBy({ estado: EstadoSolicitudStock.PENDIENTE });
      expect(pendientes).toHaveLength(0);
      const auto = await ds
        .getRepository(SolicitudStock)
        .findOneByOrFail({ resueltaPorNombre: 'Automática' });
      expect(auto.estado).toBe(EstadoSolicitudStock.APROBADA);
    });

    it('panel: lista por fechas con origen y quién resolvió', async () => {
      const servicio = app.get(SolicitudesStockService);
      const lista = await servicio.listar({ desde: hoy, hasta: hoy });
      expect(lista).toHaveLength(3);
      expect(lista.every((s) => s.origen === OrigenSolicitudStock.RITMO)).toBe(
        true,
      );
      expect(lista.map((s) => s.resueltaPor).sort()).toEqual([
        'Automática',
        'Charly (WhatsApp)',
        'Luna',
      ]);
      expect(
        await servicio.listar({ desde: '2000-01-01', hasta: '2000-01-02' }),
      ).toEqual([]);
    });

    it('rechaza pedidos mal armados', async () => {
      expect((await anotar([])).status).toBe(400);
      const cant = await anotar([{ name: 'Gasa', quantity: 50 }]);
      expect(cant.status).toBe(400);
      expect(cant.body.message).toMatch(/de 1 a 20/);
      expect((await mandar({ userId: LUNA_RITMO, action: 'x' })).status).toBe(
        400,
      );
      expect((await leer({ userId: 'x' })).status).toBe(400);
      expect(
        (await leer({ userId: LUNA_RITMO, day: '2026-02-30' })).status,
      ).toBe(400);
    });
  });
}
