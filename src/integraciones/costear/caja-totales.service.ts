import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  armarTotales,
  CajaTotales,
  diasDelRango,
  FilaCantidad,
  FilaMonto,
  ZONA,
} from './caja-totales';

/** Día AR de un timestamptz. */
const dia = (col: string) =>
  `to_char(${col} AT TIME ZONE '${ZONA}', 'YYYY-MM-DD')`;

@Injectable()
export class CajaTotalesService {
  constructor(private readonly ds: DataSource) {}

  async totales(desde: string, hasta: string): Promise<CajaTotales> {
    diasDelRango(desde, hasta); // valida antes de consultar
    // [desde 00:00 AR, hasta+1 00:00 AR)
    const p = [desde, hasta];
    const rango = (col: string) =>
      `${col} >= ($1::date::timestamp AT TIME ZONE '${ZONA}') AND ${col} < (($2::date + 1)::timestamp AT TIME ZONE '${ZONA}')`;
    const cobrada = `CASE WHEN c."estadoDeComanda" = 'PENDIENTE' THEN 'pendientes' ELSE 'ingresos' END`;
    const ingresoValido = `c."deletedAt" IS NULL AND c."tipoDeComanda" = 'INGRESO' AND c."estadoDeComanda" IN ('VALIDADO','TRASPASADA','PENDIENTE') AND ${rango('c."createdAt"')}`;
    const tieneLineasComanda = `EXISTS (SELECT 1 FROM metodos_pago x WHERE x."comandaId" = c.id AND x."deletedAt" IS NULL)`;
    const tieneLineasItems = `EXISTS (SELECT 1 FROM metodos_pago x JOIN item_comanda xi ON xi.id = x."itemComandaId" WHERE xi.comanda_id = c.id AND x."deletedAt" IS NULL AND xi."deletedAt" IS NULL)`;

    const montos: FilaMonto[] = await this.ds.query(
      `
      SELECT ${dia('c."createdAt"')} AS dia, ${cobrada} AS bloque, m.tipo::text AS clave, m.moneda::text AS moneda, SUM(m.monto_final) AS monto
        FROM metodos_pago m JOIN comandas c ON c.id = m."comandaId"
       WHERE m."deletedAt" IS NULL AND ${ingresoValido}
       GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT ${dia('c."createdAt"')}, ${cobrada}, m.tipo::text, m.moneda::text, SUM(m.monto_final)
        FROM metodos_pago m JOIN item_comanda i ON i.id = m."itemComandaId" JOIN comandas c ON c.id = i.comanda_id
       WHERE m."deletedAt" IS NULL AND i."deletedAt" IS NULL AND ${ingresoValido} AND NOT ${tieneLineasComanda}
       GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT ${dia('c."createdAt"')}, ${cobrada}, 'SIN_DETALLE', v.moneda, SUM(v.monto)
        FROM comandas c CROSS JOIN LATERAL (VALUES ('ARS', c."precioPesos"), ('USD', c."precioDolar")) AS v(moneda, monto)
       WHERE ${ingresoValido} AND NOT ${tieneLineasComanda} AND NOT ${tieneLineasItems}
       GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT ${dia('s."fechaCreacion"')}, 'senas', COALESCE(s."tipoPago"::text, 'SIN_DETALLE'), s.moneda::text, SUM(s.monto)
        FROM prepagos_guardados s
       WHERE s."deletedAt" IS NULL AND s.estado IN ('ACTIVO','UTILIZADO') AND ${rango('s."fechaCreacion"')}
       GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT ${dia('c."createdAt"')}, 'egresos', e.caja::text, UPPER(e.moneda),
             SUM(CASE WHEN UPPER(e.moneda) = 'USD' THEN e."totalDolar" ELSE e."totalPesos" END)
        FROM egreso e JOIN comandas c ON c.id = e."comandaId"
       WHERE e."deletedAt" IS NULL AND c."deletedAt" IS NULL AND c."tipoDeComanda" = 'EGRESO'
         AND c."estadoDeComanda" <> 'CANCELADA' AND ${rango('c."createdAt"')}
       GROUP BY 1, 2, 3, 4
      `,
      p,
    );

    const cantidades: FilaCantidad[] = await this.ds.query(
      `
      SELECT ${dia('c."createdAt"')} AS dia,
             CASE WHEN c."tipoDeComanda" = 'EGRESO' THEN 'egresos' WHEN c."estadoDeComanda" = 'PENDIENTE' THEN 'pendientes' ELSE 'comandas' END AS bloque,
             COUNT(*) AS n
        FROM comandas c
       WHERE c."deletedAt" IS NULL AND ${rango('c."createdAt"')}
         AND ((c."tipoDeComanda" = 'INGRESO' AND c."estadoDeComanda" IN ('VALIDADO','TRASPASADA','PENDIENTE'))
           OR (c."tipoDeComanda" = 'EGRESO' AND c."estadoDeComanda" <> 'CANCELADA'))
       GROUP BY 1, 2
      UNION ALL
      SELECT ${dia('s."fechaCreacion"')}, 'senas', COUNT(*)
        FROM prepagos_guardados s
       WHERE s."deletedAt" IS NULL AND s.estado IN ('ACTIVO','UTILIZADO') AND ${rango('s."fechaCreacion"')}
       GROUP BY 1, 2
      `,
      p,
    );

    return armarTotales(desde, hasta, montos, cantidades);
  }
}
