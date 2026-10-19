/**
 * Servicios hechos por trabajadora y día, agrupados por categoría.
 *
 * Cuenta ítems de comanda (su cantidad) que sean servicios, de comandas de
 * ingreso no canceladas ni borradas, estén o no validadas; aparte cuenta
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
