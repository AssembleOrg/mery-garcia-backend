/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- los cuerpos de supertest son `any`; acá se mira la respuesta tal cual llega */
/**
 * Compras de punta a punta por HTTP contra un Postgres descartable y un
 * Costear falso: categorías y proveedores, pedidos por estados, stock por
 * cantidades (entregas, pedidos del personal, conteos), 48 h de edición,
 * búsqueda, repetir y comprobantes mandados a Costear.
 *
 * Correr con:
 *   MERY_TEST_POSTGRES_URL=postgres://.../mery_boot_test pnpm exec jest --config test/jest-compras-e2e.json
 */
import {
  BadRequestException,
  ExecutionContext,
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
import costearConfig from 'src/config/costear.config';
import { TransformInterceptor } from 'src/interceptors/transform.interceptor';
import { AllExceptionsFilter } from 'src/errors/all-exceptions.filter';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ComprasModule } from 'src/compras/compras.module';
import { CatalogosComprasService } from 'src/compras/catalogos-compras.service';
import { StockService } from 'src/stock/stock.service';
import { StockController } from 'src/stock/stock.controller';
import { SolicitudesStockService } from 'src/stock/solicitudes-stock.service';
import { AccesosEmpleadoService } from 'src/stock/accesos-empleado.service';
import { ProductoStock } from 'src/stock/entities/ProductoStock.entity';
import { AjusteStock } from 'src/stock/entities/AjusteStock.entity';
import {
  EstadoSolicitudStock,
  SolicitudStock,
  SolicitudStockItem,
} from 'src/stock/entities/SolicitudStock.entity';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';

const URL = process.env.MERY_TEST_POSTGRES_URL;
const SECRETO_COSTEAR = 'comprobantes_prueba_secreto';
const H = 60 * 60 * 1000;

if (!URL || !URL.includes('mery_boot_test')) {
  describe.skip('compras (e2e)', () =>
    it('salteado: sin MERY_TEST_POSTGRES_URL de prueba', () => {}));
} else {
  describe('compras (e2e)', () => {
    let app: INestApplication;
    let ds: DataSource;
    let costear: Server;
    const recibidosCostear: { secreto: string; cuerpo: string; url: string }[] =
      [];
    const api = () => request(app.getHttpServer());
    // El rol sale de un header: el guard de JWT de verdad se reemplaza.
    const como = (rol = 'admin') => ({ 'x-rol': rol });

    const crearPedido = (body: object) =>
      api()
        .post('/compras/pedidos')
        .set(como())
        .send({ proveedorIds: [], items: [], ...body });

    beforeAll(async () => {
      costear = createServer((req, res) => {
        let crudo = '';
        req.setEncoding('utf8');
        req.on('data', (c) => (crudo += c));
        req.on('end', () => {
          recibidosCostear.push({
            secreto: String(req.headers['x-receipts-secret'] ?? ''),
            cuerpo: crudo,
            url: req.url ?? '',
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              data: {
                id: 'rcpt-1',
                status: req.method === 'GET' ? 'MATCHED' : 'PROCESSING',
                summary: 'Transferencia a Oui Classy',
              },
            }),
          );
        });
      });
      await new Promise<void>((r) => costear.listen(0, '127.0.0.1', r));
      process.env.COSTEAR_API_URL = `http://127.0.0.1:${(costear.address() as AddressInfo).port}/api/v1/`;
      process.env.COSTEAR_COMPROBANTES_SECRET = SECRETO_COSTEAR;

      const modulo = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [costearConfig],
          }),
          TypeOrmModule.forRoot({
            type: 'postgres',
            url: URL,
            entities: [join(__dirname, '..', 'src', '**', '*.entity.ts')],
            synchronize: true,
            dropSchema: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([ProductoStock, AjusteStock, Trabajador]),
          ComprasModule,
        ],
        controllers: [StockController],
        providers: [
          StockService,
          { provide: SolicitudesStockService, useValue: {} },
          { provide: AccesosEmpleadoService, useValue: {} },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (ctx: ExecutionContext) => {
            const req = ctx.switchToHttp().getRequest();
            req.user = {
              id: null,
              nombre: 'Mika',
              rol: req.headers['x-rol'] ?? 'admin',
            };
            return true;
          },
        })
        .compile();
      app = modulo.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
          exceptionFactory: (errors) => new BadRequestException(errors),
        }),
      );
      app.useGlobalInterceptors(new TransformInterceptor());
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();
      ds = app.get(DataSource);
    });

    afterAll(async () => {
      await app?.close();
      await new Promise((r) => costear?.close(r));
    });

    // ─── Catálogos ─────────────────────────────────────────────

    let descartables: string;
    let estilismo: string;
    let classy: string;
    let ofidirect: string;

    it('arranca con las categorías básicas y se editan libremente', async () => {
      const r = await api().get('/compras/categorias').set(como()).expect(200);
      expect(r.body.data.map((c: any) => c.nombre)).toEqual([
        'Estilismo',
        'Tatuaje cosmético',
        'Epítesis',
        'Descartables',
        'Mantenimiento',
      ]);
      descartables = r.body.data.find(
        (c: any) => c.nombre === 'Descartables',
      ).id;
      estilismo = r.body.data.find((c: any) => c.nombre === 'Estilismo').id;

      const nueva = await api()
        .post('/compras/categorias')
        .set(como())
        .send({ nombre: 'Cocina' })
        .expect(201);
      expect(nueva.body.data.orden).toBe(60);
      await api()
        .post('/compras/categorias')
        .set(como())
        .send({ nombre: ' cocina ' })
        .expect(409);
      await api()
        .put(`/compras/categorias/${nueva.body.data.id}`)
        .set(como())
        .send({ nombre: 'Café y cocina' })
        .expect(200);
      await api()
        .delete(`/compras/categorias/${nueva.body.data.id}`)
        .set(como())
        .expect(204);
    });

    it('las categorías iniciales no vuelven si las borran todas', async () => {
      const antes = await ds.query(`SELECT id FROM compras_categorias`);
      await ds.query(`DELETE FROM compras_categorias`);
      await app.get(CatalogosComprasService).sembrarCategorias();
      expect(await ds.query(`SELECT id FROM compras_categorias`)).toHaveLength(
        0,
      );
      // Las dejo como estaban para el resto.
      await ds.query(
        `DELETE FROM configuraciones_sistema WHERE clave = 'compras.categoriasIniciales'`,
      );
      await app.get(CatalogosComprasService).sembrarCategorias();
      const r = await api().get('/compras/categorias').set(como()).expect(200);
      expect(r.body.data).toHaveLength(antes.length);
      descartables = r.body.data.find(
        (c: any) => c.nombre === 'Descartables',
      ).id;
      estilismo = r.body.data.find((c: any) => c.nombre === 'Estilismo').id;
    });

    it('proveedores: alta, sin repetidos, edición y baja', async () => {
      const a = await api()
        .post('/compras/proveedores')
        .set(como())
        .send({
          nombre: 'Oui Classy SRL',
          documento: '30-71809162-0',
          email: '',
        })
        .expect(201);
      classy = a.body.data.id;
      expect(a.body.data.email).toBeNull();
      await api()
        .post('/compras/proveedores')
        .set(como())
        .send({ nombre: 'oui  classy srl' })
        .expect(409);
      await api()
        .post('/compras/proveedores')
        .set(como())
        .send({ nombre: 'X', email: 'no-es-mail' })
        .expect(400);
      const b = await api()
        .post('/compras/proveedores')
        .set(como())
        .send({ nombre: 'Ofidirect' })
        .expect(201);
      ofidirect = b.body.data.id;
      await api()
        .put(`/compras/proveedores/${ofidirect}`)
        .set(como())
        .send({ nombre: 'Ofidirect', notas: 'Melisa Menfi' })
        .expect(200);
      const l = await api()
        .get('/compras/proveedores?buscar=ofi')
        .set(como())
        .expect(200);
      expect(l.body.data.map((p: any) => p.notas)).toEqual(['Melisa Menfi']);
    });

    it('sólo admin', async () => {
      await api().get('/compras/pedidos').set(como('encargado')).expect(403);
      await api()
        .post('/compras/proveedores')
        .set(como('empleado'))
        .send({ nombre: 'Y' })
        .expect(403);
      await api()
        .get('/compras/comprobantes/00000000-0000-0000-0000-000000000000')
        .set(como('empleado'))
        .expect(403);
    });

    // ─── Pedidos ───────────────────────────────────────────────

    let pedido: any;
    let hisopos: string;

    it('una nota sola alcanza; vacío no', async () => {
      const r = await crearPedido({ nota: 'Ver si quedan toallas' }).expect(
        201,
      );
      expect(r.body.data).toMatchObject({
        estado: 'ANOTADO',
        numero: 1,
        items: [],
        editableHasta: null,
      });
      await crearPedido({}).expect(400);
      await crearPedido({ items: [{ nombre: 'A', cantidad: 0 }] }).expect(400);
    });

    it('lo que afecta stock entra al catálogo; lo demás no', async () => {
      const r = await crearPedido({
        titulo: 'Reposición',
        items: [
          {
            nombre: '  Hisopos  ',
            cantidad: 10,
            precioUnitario: 1200,
            afectaStock: true,
            categoriaIds: [descartables, estilismo],
          },
          { nombre: 'Café en grano', cantidad: 2 },
        ],
      }).expect(201);
      pedido = r.body.data;
      expect(pedido.items[0]).toMatchObject({
        nombre: 'Hisopos',
        afectaStock: true,
        precioUnitario: 1200,
      });
      expect(pedido.items[0].categorias.map((c: any) => c.nombre)).toEqual([
        'Estilismo',
        'Descartables',
      ]);
      expect(pedido.items[1]).toMatchObject({
        afectaStock: false,
        productoId: null,
      });
      expect(pedido.totalCalculado).toBe(12000);
      hisopos = pedido.items[0].productoId;
      const catalogo = await api()
        .get('/stock/productos')
        .set(como())
        .expect(200);
      expect(catalogo.body.data).toEqual([
        expect.objectContaining({
          id: hisopos,
          nombre: 'Hisopos',
          cantidad: null,
          bajo: false,
        }),
      ]);
    });

    it('para comprarlo pide proveedor; desde ahí corren las 48 h', async () => {
      await api()
        .patch(`/compras/pedidos/${pedido.id}/estado`)
        .set(como())
        .send({ estado: 'COMPRADO' })
        .expect(400);
      const r = await api()
        .put(`/compras/pedidos/${pedido.id}`)
        .set(como())
        .send({
          ...cuerpo(pedido),
          estado: 'COMPRADO',
          proveedorIds: [classy, ofidirect],
          total: 15000,
          medioPago: 'Transferencia',
        })
        .expect(200);
      pedido = r.body.data;
      expect(pedido.estado).toBe('COMPRADO');
      expect(pedido.proveedores.map((p: any) => p.nombre)).toEqual([
        'Ofidirect',
        'Oui Classy SRL',
      ]);
      expect(
        new Date(pedido.editableHasta).getTime() -
          new Date(pedido.compradoAt).getTime(),
      ).toBe(48 * H);
      expect(pedido.total).toBe(15000);
      // Comprado no suma todavía.
      expect((await cantidad(hisopos)).cantidad).toBeNull();
    });

    it('no pisa cambios de otra pestaña', async () => {
      await api()
        .put(`/compras/pedidos/${pedido.id}`)
        .set(como())
        .send({ ...cuerpo(pedido), version: pedido.version - 1 })
        .expect(409);
    });

    it('al entregarse suma lo que llegó; lo usado por el personal resta', async () => {
      const r = await api()
        .post(`/compras/pedidos/${pedido.id}/entregar`)
        .set(como())
        .send({
          recibidos: [{ itemId: pedido.items[0].id, cantidadRecibida: 8 }],
        })
        .expect(201);
      pedido = r.body.data;
      expect(pedido.estado).toBe('ENTREGADO');
      expect(pedido.items[0].cantidadRecibida).toBe(8);
      expect(await cantidad(hisopos)).toMatchObject({
        cantidad: 8,
        bajo: false,
      });

      await usarDelStock(hisopos, 7, EstadoSolicitudStock.APROBADA);
      await usarDelStock(hisopos, 50, EstadoSolicitudStock.RECHAZADA);
      expect(await cantidad(hisopos)).toMatchObject({
        cantidad: 1,
        bajo: true,
      });
    });

    it('conteo y mínimo', async () => {
      const r = await api()
        .post(`/stock/productos/${hisopos}/ajustes`)
        .set(como())
        .send({ contado: 5, motivo: 'Conteo del sábado' })
        .expect(201);
      expect(r.body.data).toEqual({ cantidad: 5, bajo: false });
      await api()
        .patch(`/stock/productos/${hisopos}`)
        .set(como())
        .send({ stockMinimo: 5 })
        .expect(200);
      expect((await cantidad(hisopos)).bajo).toBe(true);
      await api()
        .patch(`/stock/productos/${hisopos}`)
        .set(como())
        .send({ stockMinimo: null })
        .expect(200);
      expect((await cantidad(hisopos)).bajo).toBe(false);
      const aj = await api()
        .get(`/stock/productos/${hisopos}/ajustes`)
        .set(como())
        .expect(200);
      expect(aj.body.data[0]).toMatchObject({
        cantidad: 4,
        motivo: 'Conteo del sábado',
        hechoPorNombre: 'Mika',
      });
    });

    it('cancelar una entrega (dentro de las 48 h) saca lo que había sumado', async () => {
      await api()
        .patch(`/compras/pedidos/${pedido.id}/estado`)
        .set(como())
        .send({ estado: 'CANCELADO' })
        .expect(200);
      expect((await cantidad(hisopos)).cantidad).toBe(-3);
      const r = await api()
        .post(`/compras/pedidos/${pedido.id}/entregar`)
        .set(como())
        .send({})
        .expect(201);
      pedido = r.body.data;
      // Sin `recibidos` llegó todo lo pedido (10).
      expect(pedido.items[0].cantidadRecibida).toBeNull();
      expect((await cantidad(hisopos)).cantidad).toBe(7);
    });

    it('comprobante: se guarda y se manda a Costear', async () => {
      const r = await api()
        .post(`/compras/pedidos/${pedido.id}/comprobantes`)
        .set(como())
        .attach('comprobantes', Buffer.from('%PDF-1.4 transferencia'), {
          filename: 'transferencia classy.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      const c = r.body.data.comprobantes[0];
      expect(c).toMatchObject({
        nombre: 'transferencia classy.pdf',
        costearEstado: 'PENDIENTE',
        subidoPorNombre: 'Mika',
      });

      await esperar(async () => {
        const [fila] = await ds.query(
          `SELECT "costearEstado" FROM compras_comprobantes WHERE id = $1`,
          [c.id],
        );
        return fila.costearEstado === 'PROCESSING';
      });
      const enviado = recibidosCostear.find(
        (x) => x.url === '/api/v1/partners/receipts',
      );
      expect(enviado?.secreto).toBe(SECRETO_COSTEAR);
      expect(enviado?.cuerpo).toContain(`mery-compra-${c.id}`);
      expect(enviado?.cuerpo).toContain(
        'Compra N° 2 · Ofidirect, Oui Classy SRL · Reposición',
      );
      expect(enviado?.cuerpo).toContain('%PDF-1.4 transferencia');

      const estado = await api()
        .get(`/compras/comprobantes/${c.id}/costear`)
        .set(como())
        .expect(200);
      expect(estado.body.data.comprobantes[0]).toMatchObject({
        costearEstado: 'MATCHED',
        costearDetalle: 'Transferencia a Oui Classy',
      });
      const archivo = await api()
        .get(`/compras/comprobantes/${c.id}`)
        .set(como())
        .expect(200);
      expect(archivo.headers['content-type']).toBe('application/pdf');
      expect(Buffer.from(archivo.body).toString()).toBe(
        '%PDF-1.4 transferencia',
      );

      await api()
        .post(`/compras/pedidos/${pedido.id}/comprobantes`)
        .set(como())
        .attach('comprobantes', Buffer.from('MZ'), {
          filename: 'virus.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400);
    });

    it('pasadas las 48 h no se edita, pero sí se puede repetir', async () => {
      await ds.query(
        `UPDATE compras_pedidos SET "compradoAt" = now() - interval '49 hours' WHERE id = $1`,
        [pedido.id],
      );
      const r = await api()
        .get(`/compras/pedidos/${pedido.id}`)
        .set(como())
        .expect(200);
      pedido = r.body.data;
      expect(pedido.bloqueado).toBe(true);
      await api()
        .put(`/compras/pedidos/${pedido.id}`)
        .set(como())
        .send(cuerpo(pedido))
        .expect(409);
      await api()
        .patch(`/compras/pedidos/${pedido.id}/estado`)
        .set(como())
        .send({ estado: 'CANCELADO' })
        .expect(409);
      await api()
        .delete(`/compras/pedidos/${pedido.id}`)
        .set(como())
        .expect(409);
      await api()
        .delete(`/compras/comprobantes/${pedido.comprobantes[0].id}`)
        .set(como())
        .expect(409);
      // La factura que llega con la entrega se puede adjuntar igual.
      const tarde = await api()
        .post(`/compras/pedidos/${pedido.id}/comprobantes`)
        .set(como())
        .attach('comprobantes', Buffer.from('%PDF'), {
          filename: 'factura.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      expect(tarde.body.data.comprobantes).toHaveLength(2);
      // …pero borrar no.
      await api()
        .delete(`/compras/comprobantes/${tarde.body.data.comprobantes[1].id}`)
        .set(como())
        .expect(409);

      const copia = await api()
        .post(`/compras/pedidos/${pedido.id}/repetir`)
        .set(como())
        .expect(201);
      expect(copia.body.data).toMatchObject({
        estado: 'ANOTADO',
        titulo: 'Reposición',
        nota: 'Repetido del pedido N° 2.',
        total: null,
        totalCalculado: null,
        comprobantes: [],
      });
      expect(
        copia.body.data.items.map((i: any) => [
          i.nombre,
          i.cantidad,
          i.precioUnitario,
          i.afectaStock,
          i.productoId,
        ]),
      ).toEqual([
        ['Hisopos', 10, null, true, hisopos],
        ['Café en grano', 2, null, false, null],
      ]);
      expect(copia.body.data.proveedores).toHaveLength(2);
    });

    it('comprado hace más de 48 h todavía se puede marcar entregado', async () => {
      const r = await crearPedido({
        estado: 'COMPRADO',
        proveedorIds: [classy],
        items: [
          {
            productoId: hisopos,
            nombre: 'Hisopos',
            cantidad: 3,
            afectaStock: true,
          },
        ],
      }).expect(201);
      await ds.query(
        `UPDATE compras_pedidos SET "compradoAt" = now() - interval '5 days' WHERE id = $1`,
        [r.body.data.id],
      );
      await api()
        .put(`/compras/pedidos/${r.body.data.id}`)
        .set(como())
        .send(cuerpo(r.body.data))
        .expect(409);
      const antes = (await cantidad(hisopos)).cantidad;
      await api()
        .post(`/compras/pedidos/${r.body.data.id}/entregar`)
        .set(como())
        .send({})
        .expect(201);
      expect((await cantidad(hisopos)).cantidad).toBe(antes + 3);
      // Ya entregado y vencido: no se toca más.
      await api()
        .post(`/compras/pedidos/${r.body.data.id}/entregar`)
        .set(como())
        .send({})
        .expect(409);
    });

    it('busca por texto, proveedor, número, categoría y estado', async () => {
      const ids = async (q: string) =>
        (
          await api().get(`/compras/pedidos?${q}`).set(como()).expect(200)
        ).body.data.items.map((p: any) => p.numero);
      expect(await ids('buscar=hisop')).toEqual([4, 3, 2]);
      expect(await ids('buscar=toallas')).toEqual([1]);
      expect(await ids('buscar=ofidi')).toEqual([3, 2]);
      expect(await ids('buscar=%232')).toEqual([2]);
      expect(await ids('buscar=100%25')).toEqual([]);
      expect(await ids(`categoriaId=${descartables}`)).toEqual([3, 2]);
      expect(await ids(`proveedorId=${classy}&estado=ENTREGADO`)).toEqual([
        4, 2,
      ]);
      expect(await ids('estado=ABIERTOS')).toEqual([3, 1]);
      expect(await ids('limit=2&page=2')).toEqual([2, 1]);
      const por = await api()
        .get('/compras/pedidos/por-estado')
        .set(como())
        .expect(200);
      expect(por.body.data).toEqual({
        ANOTADO: 2,
        PEDIR_PRECIO: 0,
        COMPRADO: 0,
        ENTREGADO: 2,
        CANCELADO: 0,
      });
    });

    it('borrar una categoría la saca de los renglones; un proveedor dado de baja queda en lo viejo', async () => {
      await api()
        .delete(`/compras/categorias/${descartables}`)
        .set(como())
        .expect(204);
      let p = (
        await api().get(`/compras/pedidos/${pedido.id}`).set(como()).expect(200)
      ).body.data;
      expect(p.items[0].categorias.map((c: any) => c.nombre)).toEqual([
        'Estilismo',
      ]);

      await api()
        .delete(`/compras/proveedores/${ofidirect}`)
        .set(como())
        .expect(204);
      p = (
        await api().get(`/compras/pedidos/${pedido.id}`).set(como()).expect(200)
      ).body.data;
      expect(p.proveedores).toContainEqual({
        id: ofidirect,
        nombre: 'Ofidirect',
        dadoDeBaja: true,
      });
      const prov = await api()
        .get('/compras/proveedores')
        .set(como())
        .expect(200);
      expect(prov.body.data.map((x: any) => x.nombre)).toEqual([
        'Oui Classy SRL',
      ]);
      await crearPedido({ nota: 'x', proveedorIds: [ofidirect] }).expect(400);
    });

    it('borrar un pedido (dentro del plazo) lo saca de la lista y del stock', async () => {
      const r = await crearPedido({
        estado: 'ENTREGADO',
        proveedorIds: [classy],
        items: [
          { nombre: 'Guantes de nitrilo', cantidad: 100, afectaStock: true },
        ],
      }).expect(201);
      const guantes = r.body.data.items[0].productoId;
      expect((await cantidad(guantes)).cantidad).toBe(100);
      await api()
        .delete(`/compras/pedidos/${r.body.data.id}`)
        .set(como())
        .expect(204);
      expect((await cantidad(guantes)).cantidad).toBeNull();
      await api()
        .get(`/compras/pedidos/${r.body.data.id}`)
        .set(como())
        .expect(404);
    });

    // ─── Ayudas ────────────────────────────────────────────────

    function cuerpo(p: any) {
      return {
        titulo: p.titulo,
        nota: p.nota,
        estado: p.estado,
        proveedorIds: p.proveedores.map((x: any) => x.id),
        version: p.version,
        items: p.items.map((i: any) => ({
          productoId: i.productoId,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          afectaStock: i.afectaStock,
          categoriaIds: i.categorias.map((c: any) => c.id),
        })),
      };
    }

    async function cantidad(productoId: string) {
      const r = await api().get('/stock/productos').set(como()).expect(200);
      return r.body.data.find((p: any) => p.id === productoId);
    }

    let trabajador: Trabajador | undefined;
    async function usarDelStock(
      productoId: string,
      n: number,
      estado: EstadoSolicitudStock,
    ) {
      trabajador ??= await ds
        .getRepository(Trabajador)
        .save({ nombre: 'Luna' } as Trabajador);
      await ds.getRepository(SolicitudStock).save({
        trabajadorId: trabajador.id,
        estado,
        items: [
          {
            productoId,
            productoNombre: 'Hisopos',
            cantidad: n,
          } as SolicitudStockItem,
        ],
      } as SolicitudStock);
    }

    async function esperar(cond: () => Promise<boolean>) {
      for (let i = 0; i < 50; i++) {
        if (await cond()) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('no pasó a tiempo');
    }
  });
}
