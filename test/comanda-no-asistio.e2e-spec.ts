/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- se mira la respuesta del cálculo tal cual llega */
/**
 * "No se presentó" de punta a punta contra una base Postgres descartable:
 * synchronize crea la columna nueva, se crean comandas con el servicio real
 * (ComandaService) y se calcula la comisión sobre la seña.
 *
 * Correr con:
 *   MERY_TEST_POSTGRES_URL=postgres://.../mery_boot_test pnpm exec jest --config test/jest-comanda-e2e.json
 *
 * Sin esa variable (o si no apunta a mery_boot_test), se saltea.
 */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ComandaService } from 'src/comanda/comanda.service';
import { ComisionesConfigService } from 'src/comanda/services/comisiones-config.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import {
  Caja,
  Comanda,
  EstadoDeComanda,
  TipoDeComanda,
} from 'src/comanda/entities/Comanda.entity';
import { ItemComanda } from 'src/comanda/entities/ItemComanda.entity';
import { Egreso } from 'src/comanda/entities/egreso.entity';
import { Movimiento } from 'src/comanda/entities/movimiento.entity';
import { AjusteEfectivoCaja2 } from 'src/comanda/entities/ajuste-efectivo-caja2.entity';
import { CategoriaServicio } from 'src/comanda/entities/categoriaServicio.entity';
import { ComisionBase } from 'src/comanda/entities/comisionBase.entity';
import { ComisionPorcentajeMes } from 'src/comanda/entities/comisionPorcentajeMes.entity';
import { UnidadNegocio } from 'src/comanda/entities/unidadNegocio.entity';
import {
  ProductoServicio,
  TipoProductoServicio,
} from 'src/comanda/entities/productoServicio.entity';
import { Cliente } from 'src/cliente/entities/Cliente.entity';
import { MetodoPago } from 'src/cliente/entities/MetodoPago.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { TipoPago } from 'src/enums/TipoPago.enum';
import {
  NO_ASISTIO_SIN_PAGOS,
  NO_ASISTIO_SIN_SENA,
  NO_ASISTIO_SOLO_SERVICIOS,
} from 'src/comanda/no-asistio';

const URL = process.env.MERY_TEST_POSTGRES_URL;

if (!URL || !URL.includes('mery_boot_test')) {
  describe.skip('comanda "No se presentó" (e2e)', () =>
    it('salteado: sin MERY_TEST_POSTGRES_URL de prueba', () => {}));
} else {
  describe('comanda "No se presentó" (e2e)', () => {
    let ds: DataSource;
    let svc: ComandaService;
    let cfg: ComisionesConfigService;
    let close: () => Promise<void>;
    let admin: Personal;
    let rosario: Trabajador;
    let luna: Trabajador;
    let lifting: ProductoServicio;
    let crema: ProductoServicio;
    let catA: CategoriaServicio;
    let n = 0;

    const DIA = '2026-10-20';
    const alas15 = new Date(`${DIA}T15:00:00-03:00`);

    const nuevaClienta = async (seña: number, moneda = TipoMoneda.ARS) => {
      const cliente = await ds
        .getRepository(Cliente)
        .save({ nombre: `Clienta ${++n}` });
      const prepago = await ds.getRepository(PrepagoGuardado).save({
        monto: seña,
        moneda,
        estado: EstadoPrepago.ACTIVA,
        cliente,
        tipoPago: TipoPago.TRANSFERENCIA,
      } as Partial<PrepagoGuardado>);
      return { cliente, prepago };
    };

    const comandaNoAsistio = (
      clienteId: string,
      prepagoId: string,
      trabajadorId: string,
      extra: Record<string, unknown> = {},
    ) =>
      svc.crear({
        numero: `01-${9000 + ++n}`,
        tipoDeComanda: TipoDeComanda.INGRESO,
        estadoDeComanda: EstadoDeComanda.PENDIENTE,
        caja: Caja.CAJA_1,
        precioDolar: 0,
        precioPesos: 0,
        valorDolar: 1500,
        clienteId,
        creadoPorId: admin.id,
        createdAt: alas15,
        usuarioConsumePrepagoARS: true,
        usuarioConsumePrepagoUSD: false,
        prepagoARSID: prepagoId,
        noAsistio: true,
        items: [
          {
            productoServicioId: lifting.id,
            nombre: lifting.nombre,
            precio: 95000,
            cantidad: 1,
            trabajadorId,
          },
        ],
        metodosPago: [],
        ...extra,
      } as never);

    beforeAll(async () => {
      const modulo = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'postgres',
            url: URL,
            entities: [join(__dirname, '..', 'src', '**', '*.entity.ts')],
            synchronize: true,
            dropSchema: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([
            Comanda,
            Cliente,
            Trabajador,
            Personal,
            MetodoPago,
            PrepagoGuardado,
            ItemComanda,
            Egreso,
            Movimiento,
            AjusteEfectivoCaja2,
            CategoriaServicio,
            ComisionBase,
            ComisionPorcentajeMes,
          ]),
        ],
        providers: [
          ComandaService,
          ComisionesConfigService,
          { provide: AuditoriaService, useValue: {} },
        ],
      }).compile();
      const app = modulo.createNestApplication();
      await app.init();
      close = () => app.close();
      ds = app.get(DataSource);
      svc = app.get(ComandaService);
      cfg = app.get(ComisionesConfigService);

      const unidad = await ds
        .getRepository(UnidadNegocio)
        .save({ nombre: 'Estilismo' });
      catA = await ds
        .getRepository(CategoriaServicio)
        .save({ nombre: 'Categoría A', orden: 1 });
      lifting = await ds.getRepository(ProductoServicio).save({
        nombre: 'Lifting',
        precio: 95000,
        tipo: TipoProductoServicio.SERVICIO,
        unidadNegocio: unidad,
        categoria: catA,
      });
      crema = await ds.getRepository(ProductoServicio).save({
        nombre: 'Crema',
        precio: 5000,
        tipo: TipoProductoServicio.PRODUCTO,
        unidadNegocio: unidad,
      });
      rosario = await ds.getRepository(Trabajador).save({ nombre: 'Rosario' });
      luna = await ds.getRepository(Trabajador).save({ nombre: 'Luna' });
      admin = await ds.getRepository(Personal).save({
        nombre: 'Admin',
        email: 'admin@test',
        password: 'x',
        fechaIngreso: new Date(),
      });
      // Luna con esquema por base fija: 30–35%, octubre confirmado al 32%.
      await cfg.actualizarEsquema(luna.id, {
        porcentajeMin: 30,
        porcentajeMax: 35,
        productosPorcentaje: 5,
        baseDesde: '2026-10-01',
        bases: [{ categoriaId: catA.id, montoBase: 40000 }],
      } as never);
      await cfg.confirmarMes(luna.id, '2026-10', { porcentaje: 32 } as never);
    });

    afterAll(async () => {
      await close?.();
    });

    it('guarda la comanda, consume la seña y no deja pagos', async () => {
      const { cliente, prepago } = await nuevaClienta(200000);
      const c = await comandaNoAsistio(cliente.id, prepago.id, rosario.id);
      const guardada = await ds.getRepository(Comanda).findOne({
        where: { id: c.id },
        relations: ['metodosPago', 'items', 'items.metodosPago'],
      });
      expect(guardada?.noAsistio).toBe(true);
      expect(Number(guardada?.precioPesos)).toBe(0);
      expect(Number(guardada?.precioDolar)).toBe(0);
      expect(guardada?.metodosPago ?? []).toHaveLength(0);
      const seña = await ds
        .getRepository(PrepagoGuardado)
        .findOneByOrFail({ id: prepago.id });
      expect(seña.estado).toBe(EstadoPrepago.UTILIZADA);
    });

    it('rechaza sin seña, con pagos o con productos (y no consume nada)', async () => {
      const { cliente, prepago } = await nuevaClienta(50000);
      await expect(
        comandaNoAsistio(cliente.id, prepago.id, rosario.id, {
          usuarioConsumePrepagoARS: false,
          prepagoARSID: undefined,
        }),
      ).rejects.toThrow(new BadRequestException(NO_ASISTIO_SIN_SENA));
      await expect(
        comandaNoAsistio(cliente.id, prepago.id, rosario.id, {
          precioPesos: 10000,
          metodosPago: [
            {
              tipo: TipoPago.EFECTIVO,
              monto: 10000,
              montoFinal: 10000,
              descuentoGlobalPorcentaje: 0,
              moneda: TipoMoneda.ARS,
            },
          ],
        }),
      ).rejects.toThrow(new BadRequestException(NO_ASISTIO_SIN_PAGOS));
      await expect(
        comandaNoAsistio(cliente.id, prepago.id, rosario.id, {
          items: [
            {
              productoServicioId: lifting.id,
              nombre: 'Lifting',
              precio: 95000,
              cantidad: 1,
              trabajadorId: rosario.id,
            },
            {
              productoServicioId: crema.id,
              nombre: 'Crema',
              precio: 5000,
              cantidad: 1,
              trabajadorId: rosario.id,
            },
          ],
        }),
      ).rejects.toThrow(new BadRequestException(NO_ASISTIO_SOLO_SERVICIOS));
      const seña = await ds
        .getRepository(PrepagoGuardado)
        .findOneByOrFail({ id: prepago.id });
      expect(seña.estado).toBe(EstadoPrepago.ACTIVA);
    });

    it('comisión sobre la seña: 30% histórico y % confirmado del esquema; no cuenta como servicio', async () => {
      const a = await nuevaClienta(15000);
      await comandaNoAsistio(a.cliente.id, a.prepago.id, luna.id);
      const r: any = await svc.calcularComisionesTrabajadores({
        fechaDesde: '2026-10-01',
        fechaHasta: '2026-10-31',
      });
      const ro = r.trabajadores.find((t: any) => t.nombre === 'Rosario');
      const lu = r.trabajadores.find((t: any) => t.nombre === 'Luna');
      // Rosario: seña $200.000 × 30% (cálculo histórico).
      expect(ro.noAsistio).toMatchObject({
        cantidad: 1,
        señaARS: 200000,
        comisionARS: 60000,
      });
      expect(ro.comisiones.totalARS).toBe(60000);
      expect(ro.serviciosARS).toBe(0);
      expect(ro.categorias).toEqual([]);
      // Luna: seña $15.000 × 32% (octubre confirmado); el servicio no suma a la base fija.
      expect(lu.noAsistio).toMatchObject({
        cantidad: 1,
        señaARS: 15000,
        comisionARS: 4800,
      });
      expect(lu.noAsistio.detalle[0]).toMatchObject({
        servicio: 'Lifting',
        porcentaje: 32,
        confirmado: true,
        dia: DIA,
      });
      expect(lu.esquemaBase.servicios).toEqual([]);
      expect(lu.comisiones.totalARS).toBe(4800);
    });

    it('editar: se puede desmarcar y volver a marcar; marcada no acepta pagos', async () => {
      const { cliente, prepago } = await nuevaClienta(80000);
      const c = await comandaNoAsistio(cliente.id, prepago.id, rosario.id);
      await expect(
        svc.actualizar(c.id, {
          metodosPago: [
            {
              tipo: TipoPago.EFECTIVO,
              monto: 5000,
              montoFinal: 5000,
              descuentoGlobalPorcentaje: 0,
              moneda: TipoMoneda.ARS,
            },
          ],
          precioPesos: 5000,
        } as never),
      ).rejects.toThrow(new BadRequestException(NO_ASISTIO_SIN_PAGOS));
      await svc.actualizar(c.id, { noAsistio: false } as never);
      expect(
        (await ds.getRepository(Comanda).findOneByOrFail({ id: c.id }))
          .noAsistio,
      ).toBe(false);
      await svc.actualizar(c.id, { noAsistio: true } as never);
      expect(
        (await ds.getRepository(Comanda).findOneByOrFail({ id: c.id }))
          .noAsistio,
      ).toBe(true);
    });
  });
}
