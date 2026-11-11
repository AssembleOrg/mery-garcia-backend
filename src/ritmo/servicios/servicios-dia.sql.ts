/**
 * Servicios hechos por trabajadora y día, agrupados por categoría.
 *
 * Cuenta ítems de comanda (su cantidad) que sean servicios, de comandas de
 * ingreso no canceladas ni borradas, estén o no validadas (las de una clienta
 * que no se presentó no son un servicio hecho: no cuentan); aparte cuenta
 * las que ya están validadas. El día es el de la comanda en la zona del
 * salón.
 *
 * Parámetros: $1 zona horaria, $2 desde (AAAA-MM-DD), $3 hasta (AAAA-MM-DD),
 * $4 trabajadorId o NULL (todas).
 */
export const SQL_SERVICIOS_POR_DIA = `
  SELECT ic.trabajador_id                                    AS "trabajadorId",
         to_char(c."createdAt" AT TIME ZONE $1, 'YYYY-MM-DD') AS dia,
         ps.categoria_id                                      AS "categoriaId",
         SUM(ic.cantidad)::int                                AS cantidad,
         SUM(CASE WHEN c."estadoDeComanda" = 'VALIDADO' THEN ic.cantidad ELSE 0 END)::int AS validadas
    FROM item_comanda ic
    JOIN comandas c             ON c.id = ic.comanda_id
    JOIN productos_servicios ps ON ps.id = ic.producto_servicio_id
   WHERE ic."deletedAt" IS NULL
     AND c."deletedAt" IS NULL
     AND c."tipoDeComanda" = 'INGRESO'
     AND c."estadoDeComanda" <> 'CANCELADA'
     AND c."noAsistio" = false
     AND ps.tipo = 'SERVICIO'
     AND (c."createdAt" AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
     AND ($4::uuid IS NULL OR ic.trabajador_id = $4::uuid)
   GROUP BY ic.trabajador_id, dia, ps.categoria_id
   ORDER BY dia, ic.trabajador_id
`;

export interface FilaSqlServicios {
  trabajadorId: string;
  dia: string;
  categoriaId: string | null;
  cantidad: number;
  validadas: number;
}

/**
 * En cuántas comandas estuvo cada trabajadora cada día: comandas de ingreso
 * no canceladas ni borradas (ni de clientas que no se presentaron) con al
 * menos un ítem a su nombre (servicio o producto). Una comanda con dos servicios suyos cuenta una vez.
 *
 * Mismos parámetros que SQL_SERVICIOS_POR_DIA.
 */
export const SQL_COMANDAS_POR_DIA = `
  SELECT ic.trabajador_id                                    AS "trabajadorId",
         to_char(c."createdAt" AT TIME ZONE $1, 'YYYY-MM-DD') AS dia,
         COUNT(DISTINCT c.id)::int                            AS comandas
    FROM item_comanda ic
    JOIN comandas c ON c.id = ic.comanda_id
   WHERE ic."deletedAt" IS NULL
     AND c."deletedAt" IS NULL
     AND ic.trabajador_id IS NOT NULL
     AND c."tipoDeComanda" = 'INGRESO'
     AND c."estadoDeComanda" <> 'CANCELADA'
     AND c."noAsistio" = false
     AND (c."createdAt" AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
     AND ($4::uuid IS NULL OR ic.trabajador_id = $4::uuid)
   GROUP BY ic.trabajador_id, dia
`;

export interface FilaSqlComandas {
  trabajadorId: string;
  dia: string;
  comandas: number;
}

/**
 * Productos vendidos por trabajadora y día: un renglón por producto y
 * comanda, con cuántas unidades. Mismas comandas que cuentan para
 * SQL_COMANDAS_POR_DIA (ingreso, no canceladas ni borradas, la clienta se
 * presentó), estén o no validadas.
 *
 * Sale directo de las comandas y no del cálculo de comisiones: ahí un
 * producto que no comisiona no deja renglón, y acá tiene que estar igual,
 * porque es lo que la persona confirma que vendió.
 *
 * Mismos parámetros que SQL_SERVICIOS_POR_DIA.
 */
export const SQL_PRODUCTOS_POR_DIA = `
  SELECT ic.trabajador_id                                    AS "trabajadorId",
         to_char(c."createdAt" AT TIME ZONE $1, 'YYYY-MM-DD') AS dia,
         ps.nombre                                            AS item,
         c.numero                                             AS numero,
         SUM(ic.cantidad)::int                                AS cantidad,
         (c."estadoDeComanda" = 'VALIDADO')                   AS validada
    FROM item_comanda ic
    JOIN comandas c             ON c.id = ic.comanda_id
    JOIN productos_servicios ps ON ps.id = ic.producto_servicio_id
   WHERE ic."deletedAt" IS NULL
     AND c."deletedAt" IS NULL
     AND ic.trabajador_id IS NOT NULL
     AND c."tipoDeComanda" = 'INGRESO'
     AND c."estadoDeComanda" <> 'CANCELADA'
     AND c."noAsistio" = false
     AND ps.tipo = 'PRODUCTO'
     AND (c."createdAt" AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
     AND ($4::uuid IS NULL OR ic.trabajador_id = $4::uuid)
   GROUP BY ic.trabajador_id, dia, ps.nombre, c.numero, c."estadoDeComanda"
   ORDER BY dia, ic.trabajador_id, ps.nombre, c.numero
`;

export interface FilaSqlProductos {
  trabajadorId: string;
  dia: string;
  item: string;
  numero: string;
  cantidad: number;
  validada: boolean;
}
