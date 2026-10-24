import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ZONA } from './caja-totales';
import {
  armarMovimientos,
  FilaComanda,
  FilaEgreso,
  FilaItem,
  FilaPago,
  FilaSena,
  MovimientosDia,
  validarDia,
} from './movimientos-dia';

const hora = (col: string) =>
  `to_char(${col} AT TIME ZONE '${ZONA}', 'HH24:MI')`;

@Injectable()
export class MovimientosDiaService {
  constructor(private readonly ds: DataSource) {}

  /** Todo lo de un día AR: [dia 00:00 AR, dia+1 00:00 AR). Mismos filtros que `CajaTotalesService`. */
  async delDia(dia: string): Promise<MovimientosDia> {
    validarDia(dia);
    const p = [dia];
    const rango = (col: string) =>
      `${col} >= ($1::date::timestamp AT TIME ZONE '${ZONA}') AND ${col} < (($1::date + 1)::timestamp AT TIME ZONE '${ZONA}')`;
    const ingresoValido = `c."deletedAt" IS NULL AND c."tipoDeComanda" = 'INGRESO' AND c."estadoDeComanda" IN ('VALIDADO','TRASPASADA','PENDIENTE') AND ${rango('c."createdAt"')}`;
    const egresoValido = `c."deletedAt" IS NULL AND c."tipoDeComanda" = 'EGRESO' AND c."estadoDeComanda" <> 'CANCELADA' AND ${rango('c."createdAt"')}`;

    const [comandas, pagos, items, senas, egresos, itemsEgreso] =
      await Promise.all([
        this.ds.query<FilaComanda[]>(
          `SELECT c.id, c.numero, ${hora('c."createdAt"')} AS hora, c."estadoDeComanda"::text AS estado,
                cl.nombre AS cliente, pe.nombre AS creado_por, c.observaciones,
                c."precioPesos" AS precio_pesos, c."precioDolar" AS precio_dolar
           FROM comandas c
           LEFT JOIN clientes cl ON cl.id = c."clienteId"
           LEFT JOIN personal pe ON pe.id = c."creadoPorId"
          WHERE ${ingresoValido}
          ORDER BY c."createdAt"`,
          p,
        ),
        // Las líneas de la comanda; si no tiene, las de sus ítems (como en los totales).
        this.ds.query<FilaPago[]>(
          `SELECT c.id AS comanda_id, m.tipo::text AS tipo, m.moneda::text AS moneda, m.monto_final AS monto
           FROM metodos_pago m JOIN comandas c ON c.id = m."comandaId"
          WHERE m."deletedAt" IS NULL AND ${ingresoValido}
         UNION ALL
         SELECT c.id, m.tipo::text, m.moneda::text, m.monto_final
           FROM metodos_pago m JOIN item_comanda i ON i.id = m."itemComandaId" JOIN comandas c ON c.id = i.comanda_id
          WHERE m."deletedAt" IS NULL AND i."deletedAt" IS NULL AND ${ingresoValido}
            AND NOT EXISTS (SELECT 1 FROM metodos_pago x WHERE x."comandaId" = c.id AND x."deletedAt" IS NULL)`,
          p,
        ),
        this.ds.query<FilaItem[]>(
          `SELECT i.comanda_id, i.nombre, i.cantidad, i.subtotal, t.nombre AS trabajador
           FROM item_comanda i JOIN comandas c ON c.id = i.comanda_id
           LEFT JOIN trabajadores t ON t.id = i.trabajador_id
          WHERE i."deletedAt" IS NULL AND ${ingresoValido}
          ORDER BY i."createdAt"`,
          p,
        ),
        this.ds.query<FilaSena[]>(
          `SELECT s.id, ${hora('s."fechaCreacion"')} AS hora, cl.nombre AS cliente, s."tipoPago"::text AS tipo_pago,
                s.moneda::text AS moneda, s.monto, s.estado::text AS estado, s.observaciones,
                s."servicioReservado" AS servicio,
                to_char(s."fechaTurno" AT TIME ZONE '${ZONA}', 'YYYY-MM-DD') AS turno
           FROM prepagos_guardados s
           LEFT JOIN clientes cl ON cl.id = s.cliente_id
          WHERE s."deletedAt" IS NULL AND s.estado IN ('ACTIVO','UTILIZADO') AND ${rango('s."fechaCreacion"')}
          ORDER BY s."fechaCreacion"`,
          p,
        ),
        this.ds.query<FilaEgreso[]>(
          `SELECT e.id, ${hora('c."createdAt"')} AS hora, e.caja::text AS caja, UPPER(e.moneda) AS moneda,
                CASE WHEN UPPER(e.moneda) = 'USD' THEN e."totalDolar" ELSE e."totalPesos" END AS monto,
                c.numero, c.observaciones, pe.nombre AS creado_por, c.id AS comanda_id
           FROM egreso e JOIN comandas c ON c.id = e."comandaId"
           LEFT JOIN personal pe ON pe.id = c."creadoPorId"
          WHERE e."deletedAt" IS NULL AND ${egresoValido}
          ORDER BY c."createdAt"`,
          p,
        ),
        this.ds.query<FilaItem[]>(
          `SELECT i.comanda_id, i.nombre, i.cantidad, i.subtotal, NULL AS trabajador
           FROM item_comanda i JOIN comandas c ON c.id = i.comanda_id
          WHERE i."deletedAt" IS NULL AND ${egresoValido}
          ORDER BY i."createdAt"`,
          p,
        ),
      ]);

    return armarMovimientos(
      dia,
      comandas,
      pagos,
      items,
      senas,
      egresos,
      itemsEgreso,
    );
  }
}
