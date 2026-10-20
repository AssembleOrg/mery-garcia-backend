/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- los cuerpos de supertest son `any` */
/**
 * Historial del turno de las señas de reserva online, contra una base Postgres
 * descartable: synchronize crea la tabla y las columnas nuevas, y se prueban
 * los endpoints que llama booking (pagada y evento) y el reporte de reservados.
 *
 * Correr con:
 *   MERY_TEST_POSTGRES_URL=postgres://.../mery_boot_test pnpm exec jest --config test/jest-reservas-e2e.json
 *
 * Sin esa variable (o si no es la base `mery_boot_test`), se saltea.
 */
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { join } from 'path';
import { DataSource } from 'typeorm';
import bookingConfig from 'src/config/booking.config';
import { ReservasModule } from 'src/reservas/reservas.module';
import { ReporteReservadosService } from 'src/reservas/reporte-reservados.service';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';
import { PrepagoTurnoEvento } from 'src/reservas/entities/prepago-turno-evento.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { Cliente } from 'src/cliente/entities/Cliente.entity';
import { UnidadNegocio } from 'src/comanda/entities/unidadNegocio.entity';
import { ProductoServicio, TipoProductoServicio } from 'src/comanda/entities/productoServicio.entity';
import { Caja, Comanda, EstadoDeComanda, TipoDeComanda } from 'src/comanda/entities/Comanda.entity';
import { ItemComanda } from 'src/comanda/entities/ItemComanda.entity';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { TipoPago } from 'src/enums/TipoPago.enum';

const URL = process.env.MERY_TEST_POSTGRES_URL;
const SECRET = 'reservas_prueba_secreto';

if (!URL || !URL.includes('mery_boot_test')) {
  describe.skip('historial de turnos de señas (e2e)', () =>
    it('salteado: sin MERY_TEST_POSTGRES_URL de prueba', () => {}));
} else {
  describe('historial de turnos de señas (e2e)', () => {
    let app: INestApplication;
    let ds: DataSource;

    const pagada = (body: object, secret = SECRET) =>
      request(app.getHttpServer())
        .post('/api/reservas/booking/pagada')
        .set('x-booking-secret', secret)
        .send(body);
    const evento = (body: object, secret = SECRET) =>
      request(app.getHttpServer())
        .post('/api/reservas/booking/evento')
        .set('x-booking-secret', secret)
        .send(body);
    const sena = (bookingId: string) =>
      ds.getRepository(PrepagoGuardado).findOneOrFail({ where: { bookingId } });
    const eventos = (bookingId: string) =>
      ds.getRepository(PrepagoTurnoEvento).find({ where: { bookingId }, order: { ocurridoEn: 'ASC' } });

    const cliente = { fullName: 'Ana Prueba', email: 'ana@prueba.test', phone: '1155550000', dni: '30111222' };

    beforeAll(async () => {
      process.env.BOOKING_SYNC_SECRET = SECRET;
      const modulo = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [bookingConfig] }),
          TypeOrmModule.forRoot({
            type: 'postgres',
            url: URL,
            entities: [join(__dirname, '..', 'src', '**', '*.entity.ts')],
            synchronize: true,
            dropSchema: true,
            logging: false,
          }),
          ReservasModule,
        ],
      }).compile();
      app = modulo.createNestApplication();
      app.setGlobalPrefix('api');
      await app.init();
      ds = app.get(DataSource);
    });

    afterAll(async () => {
      await app?.close();
    });

    it('rechaza el secret equivocado', async () => {
      const r = await evento({ eventoId: 'x', bookingId: 'b', tipo: 'REPROGRAMADA' }, 'otro');
      expect(r.body).toEqual({ ok: false, error: 'no autorizado' });
    });

    it('la seña pagada guarda el turno y el servicio originales, y el evento CREADA', async () => {
      const r = await pagada({
        bookingId: 'bk-1',
        bookingCode: 'AAA111',
        servicioReservado: 'Nanoblading [Mantenimiento]',
        servicioId: 'svc-nano',
        empleadoReservado: 'Mery Garcia',
        montoSena: 150000,
        fechaTurno: '2026-10-24T15:00:00-03:00',
        cliente,
      });
      expect(r.body.ok).toBe(true);
      const s = await sena('bk-1');
      expect(s.fechaTurnoOriginal?.toISOString()).toBe('2026-10-24T18:00:00.000Z');
      expect(s.fechaTurno?.toISOString()).toBe('2026-10-24T18:00:00.000Z');
      expect(s.servicioOriginal).toBe('Nanoblading [Mantenimiento]');
      expect(s.servicioIdReservado).toBe('svc-nano');
      expect(s.reprogramaciones).toBe(0);
      const ev = await eventos('bk-1');
      expect(ev.map((e) => e.tipo)).toEqual(['CREADA']);
    });

    it('una reprogramación desde el panel mueve el turno vigente y deja el antes/después', async () => {
      const r = await evento({
        eventoId: 'ev-1',
        bookingId: 'bk-1',
        bookingCode: 'AAA111',
        tipo: 'REPROGRAMADA',
        origen: 'ADMIN',
        actor: 'Micaela',
        ocurridoEn: '2026-10-21T12:00:00Z',
        antes: { startTime: '2026-10-24T18:00:00.000Z', serviceId: 'svc-nano', serviceName: 'Nanoblading [Mantenimiento]', employeeName: 'Mery Garcia', status: 'CONFIRMED' },
        despues: { startTime: '2026-11-14T17:00:00.000Z', serviceId: 'svc-lip', serviceName: 'Lip Blush', employeeName: 'Mery Garcia', status: 'CONFIRMED' },
      });
      expect(r.body).toEqual({ ok: true, duplicado: false, sinSena: false });
      const s = await sena('bk-1');
      expect(s.fechaTurno?.toISOString()).toBe('2026-11-14T17:00:00.000Z');
      expect(s.fechaTurnoOriginal?.toISOString()).toBe('2026-10-24T18:00:00.000Z');
      expect(s.servicioReservado).toBe('Lip Blush');
      expect(s.servicioOriginal).toBe('Nanoblading [Mantenimiento]');
      expect(s.servicioIdReservado).toBe('svc-lip');
      expect(s.reprogramaciones).toBe(1);
      const ev = (await eventos('bk-1')).find((e) => e.eventoId === 'ev-1')!;
      expect(ev).toMatchObject({
        tipo: 'REPROGRAMADA',
        origen: 'ADMIN',
        actor: 'Micaela',
        servicioAnterior: 'Nanoblading [Mantenimiento]',
        servicioNuevo: 'Lip Blush',
      });
      expect(ev.fechaTurnoAnterior?.toISOString()).toBe('2026-10-24T18:00:00.000Z');
      expect(ev.fechaTurnoNueva?.toISOString()).toBe('2026-11-14T17:00:00.000Z');
    });

    it('el mismo evento repetido (reintento) no se cuenta dos veces', async () => {
      const r = await evento({ eventoId: 'ev-1', bookingId: 'bk-1', tipo: 'REPROGRAMADA', despues: { startTime: '2027-01-01T12:00:00Z' } });
      expect(r.body.duplicado).toBe(true);
      const s = await sena('bk-1');
      expect(s.reprogramaciones).toBe(1);
      expect(s.fechaTurno?.toISOString()).toBe('2026-11-14T17:00:00.000Z');
    });

    it('un evento viejo que llega tarde se guarda y cuenta, pero no pisa el turno vigente', async () => {
      const r = await evento({
        eventoId: 'ev-0',
        bookingId: 'bk-1',
        tipo: 'REPROGRAMADA',
        origen: 'CLIENTA',
        ocurridoEn: '2026-10-20T09:00:00Z',
        despues: { startTime: '2026-10-30T18:00:00.000Z', serviceName: 'Otro' },
      });
      expect(r.body.ok).toBe(true);
      const s = await sena('bk-1');
      expect(s.reprogramaciones).toBe(2);
      expect(s.fechaTurno?.toISOString()).toBe('2026-11-14T17:00:00.000Z');
      expect(s.servicioReservado).toBe('Lip Blush');
    });

    it('la cancelación marca el turno pero no toca la seña', async () => {
      await pagada({ bookingId: 'bk-2', servicioReservado: 'Laminado', montoSena: 40000, fechaTurno: '2026-10-25T13:00:00Z', cliente });
      const r = await evento({
        eventoId: 'ev-2',
        bookingId: 'bk-2',
        tipo: 'CANCELADA',
        origen: 'ADMIN',
        ocurridoEn: '2026-10-22T10:00:00Z',
        antes: { startTime: '2026-10-25T13:00:00Z', status: 'CONFIRMED' },
        despues: { startTime: '2026-10-25T13:00:00Z', status: 'CANCELLED' },
      });
      expect(r.body.ok).toBe(true);
      const s = await sena('bk-2');
      expect(s.turnoCanceladoEn?.toISOString()).toBe('2026-10-22T10:00:00.000Z');
      expect(s.estado).toBe(EstadoPrepago.ACTIVA);
      expect(Number(s.monto)).toBe(40000);
      expect(s.reprogramaciones).toBe(0);
    });

    it('si la reserva no tiene seña acá, no guarda nada', async () => {
      const r = await evento({ eventoId: 'ev-3', bookingId: 'bk-sin-sena', tipo: 'REPROGRAMADA' });
      expect(r.body).toEqual({ ok: true, duplicado: false, sinSena: true });
      expect(await eventos('bk-sin-sena')).toHaveLength(0);
    });

    it('la carga inicial detecta una reprogramación anterior al historial', async () => {
      // Seña vieja, de antes de esta versión: sin turno original ni eventos.
      const cli = await ds.getRepository(Cliente).save({ nombre: 'Vieja', telefono: '', email: 'vieja@prueba.test' });
      await ds.getRepository(PrepagoGuardado).save({
        monto: 80000,
        moneda: TipoMoneda.ARS,
        estado: EstadoPrepago.ACTIVA,
        tipoPago: TipoPago.MERCADO_PAGO,
        cliente: cli,
        bookingId: 'bk-vieja',
        servicioReservado: 'Laminado',
        serviciosReservados: ['Laminado'],
        fechaTurno: new Date('2026-10-10T15:00:00Z'),
      });
      const r = await evento({
        eventoId: 'snap-1',
        bookingId: 'bk-vieja',
        tipo: 'ESTADO_INICIAL',
        origen: 'SISTEMA',
        actor: 'carga inicial',
        despues: { startTime: '2026-10-31T15:00:00Z', serviceId: 'svc-lam', serviceName: 'Laminado', status: 'CONFIRMED' },
      });
      expect(r.body.ok).toBe(true);
      const s = await sena('bk-vieja');
      expect(s.fechaTurnoOriginal?.toISOString()).toBe('2026-10-10T15:00:00.000Z');
      expect(s.servicioOriginal).toBe('Laminado');
      expect(s.fechaTurno?.toISOString()).toBe('2026-10-31T15:00:00.000Z');
      expect(s.reprogramaciones).toBe(1);
    });

    it('el reporte dice si la seña se usó el día del turno y para el servicio reservado', async () => {
      const personal = await ds.getRepository(Personal).save({ nombre: 'Recepción', email: 'info@test', password: 'x', fechaIngreso: new Date() });
      const unidad = await ds.getRepository(UnidadNegocio).save({ nombre: 'Tattoo' });
      const lip = await ds.getRepository(ProductoServicio).save({ nombre: 'LIP BLUSH efectivo', precio: 500, tipo: TipoProductoServicio.SERVICIO, unidadNegocio: unidad });
      const laminado = await ds.getRepository(ProductoServicio).save({ nombre: 'Laminado de Cejas', precio: 52500, tipo: TipoProductoServicio.SERVICIO, unidadNegocio: unidad });

      const usar = async (bookingId: string, numero: string, cuando: string, ps: ProductoServicio) => {
        const s = await sena(bookingId);
        const c = await ds.getRepository(Comanda).save({
          numero,
          caja: Caja.CAJA_1,
          tipoDeComanda: TipoDeComanda.INGRESO,
          estadoDeComanda: EstadoDeComanda.PENDIENTE,
          creadoPor: personal,
          createdAt: new Date(cuando),
          precioDolar: 0,
          precioPesos: 0,
          valorDolar: 0,
          usuarioConsumePrepagoARS: true,
          prepagoARSID: s.id,
        });
        await ds.getRepository(ItemComanda).save({ comanda: c, productoServicio: ps, nombre: ps.nombre, precio: ps.precio, cantidad: 1 });
        await ds.getRepository(PrepagoGuardado).update(s.id, { estado: EstadoPrepago.UTILIZADA });
      };
      // bk-1: turno vigente 14/11 14:00 AR, Lip Blush → se usa ese día para Lip Blush.
      await usar('bk-1', '01-0001', '2026-11-14T15:30:00-03:00', lip);
      // bk-vieja: turno vigente 31/10, Laminado → se usa 3 días después.
      await usar('bk-vieja', '01-0002', '2026-11-03T12:00:00-03:00', laminado);

      const rep = await app.get(ReporteReservadosService).generar({ fechaDesde: '2026-10-01', fechaHasta: '2026-11-30' });
      const f1 = rep.filas.find((f) => f.bookingCode === 'AAA111')!;
      expect(f1).toMatchObject({
        estadoUso: 'USADA',
        coincidencia: 'COINCIDE',
        diasDesdeTurno: 0,
        usadaEnTiempoYForma: true,
        reprogramaciones: 2,
        servicioOriginal: 'Nanoblading [Mantenimiento]',
        fechaTurnoOriginal: '2026-10-24T18:00:00.000Z',
      });
      const vieja = await sena('bk-vieja');
      const f2 = rep.filas.find((f) => f.prepagoId === vieja.id)!;
      expect(f2).toMatchObject({ estadoUso: 'USADA', diasDesdeTurno: 3, usadaEnTiempoYForma: false });
      const f3 = rep.filas.find((f) => f.servicioReservado === 'Laminado' && f.turnoCancelado)!;
      expect(f3).toMatchObject({ estadoUso: 'SIN_USAR', diasDesdeTurno: null, usadaEnTiempoYForma: null });
    });
  });
}
