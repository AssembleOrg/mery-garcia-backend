/**
 * Script para calcular comisiones del 1 al 31 de enero 2026
 * Replica la lógica del endpoint GET /api/comandas/comisiones
 *
 * Uso: pnpm run comisiones-enero
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });

// ─── Configuración ───────────────────────────────────────────────
const FECHA_DESDE = '2026-01-01';
const FECHA_HASTA = '2026-01-31';
const TZ = 'America/Argentina/Buenos_Aires';

// Tasas de comisión (mismas que el endpoint)
const COMISION_SERVICIOS = 0.30; // 30%
const COMISION_PRODUCTOS = 0.10; // 10%

// ─── Tipos ───────────────────────────────────────────────────────
interface ItemRow {
  trabajador_id: string;
  trabajador_nombre: string;
  producto_servicio_tipo: 'SERVICIO' | 'PRODUCTO';
  producto_servicio_nombre: string;
  es_precio_congelado: boolean;
  unidad_negocio: string | null;
  item_precio: string;
  item_cantidad: number;
  item_descuento: string;
  valor_dolar: string;
}

interface ProductoServicioDetalle {
  nombre: string;
  cantidad: number;
  tipo: 'SERVICIO' | 'PRODUCTO';
  subtotal: number;
}

interface TrabajadorData {
  trabajadorId: string;
  nombre: string;
  // Totales sin descuento del -10%
  totalServicios: number;
  totalProductos: number;
  // Unidades de negocio: nombre -> cantidad
  unidadesNegocio: Map<string, number>;
  // Detalle de productos/servicios
  serviciosDetalle: Map<string, ProductoServicioDetalle>;
  productosDetalle: Map<string, ProductoServicioDetalle>;
  // Caso especial Rosario
  cantidadConsultas: number;
  totalConsultas: number;
}

// ─── Helpers ─────────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function padL(str: string, len: number): string {
  return str.padStart(len);
}

function line(char = '─', len = 90): string {
  return char.repeat(len);
}

function doubleLine(len = 90): string {
  return '═'.repeat(len);
}

// ─── Main ────────────────────────────────────────────────────────
async function calcularComisiones() {
  console.log('\n' + doubleLine());
  console.log('  COMISIONES - ENERO 2026 (01/01 al 31/01)');
  console.log(doubleLine() + '\n');

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('railway')
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    await dataSource.initialize();
    console.log('Conexion a DB establecida\n');

    // Query principal: traer todos los items de comandas de CAJA_1, INGRESO,
    // estados VALIDADO/PENDIENTE/TRASPASADA, en el rango de fechas
    // Usa ic.precio: para congelados ya está en ARS, para no congelados está en USD
    const items: ItemRow[] = await dataSource.query(`
      SELECT
        t.id                       AS trabajador_id,
        t.nombre                   AS trabajador_nombre,
        ps.tipo                    AS producto_servicio_tipo,
        ps.nombre                  AS producto_servicio_nombre,
        ps."esPrecioCongelado"     AS es_precio_congelado,
        un.nombre                  AS unidad_negocio,
        ic.precio                  AS item_precio,
        ic.cantidad                AS item_cantidad,
        ic.descuento               AS item_descuento,
        c."valorDolar"             AS valor_dolar
      FROM comandas c
      JOIN item_comanda ic         ON ic.comanda_id = c.id
      JOIN trabajadores t          ON t.id = ic.trabajador_id
      JOIN productos_servicios ps  ON ps.id = ic.producto_servicio_id
      LEFT JOIN unidades_negocio un ON un.id = ps."unidadNegocioId"
      WHERE c.caja = 'caja_1'
        AND c."tipoDeComanda" = 'INGRESO'
        AND c."estadoDeComanda" IN ('VALIDADO', 'PENDIENTE', 'TRASPASADA')
        AND c."deletedAt" IS NULL
        AND ic."deletedAt" IS NULL
        AND c."createdAt" AT TIME ZONE '${TZ}' >= '${FECHA_DESDE} 00:00:00'
        AND c."createdAt" AT TIME ZONE '${TZ}' <= '${FECHA_HASTA} 23:59:59.999'
      ORDER BY t.nombre, ps.tipo, ps.nombre
    `);

    console.log(`Total de items encontrados: ${items.length}\n`);

    if (items.length === 0) {
      console.log('No se encontraron comandas en el rango de fechas.\n');
      return;
    }

    // ─── Procesar items ──────────────────────────────────────────
    const trabajadoresMap = new Map<string, TrabajadorData>();

    // Totales generales
    let totalGeneralServiciosSinDesc = 0;
    let totalGeneralServiciosConDesc = 0;
    let totalGeneralProductosSinDesc = 0;
    let totalGeneralProductosConDesc = 0;

    for (const item of items) {
      const trabajadorId = item.trabajador_id;
      const nombre = item.trabajador_nombre;
      const tipo = item.producto_servicio_tipo;
      const unidadNegocio = item.unidad_negocio;
      const cantidad = Number(item.item_cantidad ?? 1);
      const descuento = Number(item.item_descuento ?? 0);

      // Caso especial: Rosario + Consultas
      const esRosarioConsulta = nombre === 'Rosario' && unidadNegocio === 'Consultas';

      // Precio: ic.precio ya en ARS para congelados, en USD para no congelados
      let precio = Number(item.item_precio ?? 0);
      if (!item.es_precio_congelado) {
        const valorDolar = Number(item.valor_dolar ?? 1);
        precio = precio * valorDolar;
      }

      // Inicializar trabajador si no existe
      if (!trabajadoresMap.has(trabajadorId)) {
        trabajadoresMap.set(trabajadorId, {
          trabajadorId,
          nombre,
          totalServicios: 0,
          totalProductos: 0,
          unidadesNegocio: new Map(),
          serviciosDetalle: new Map(),
          productosDetalle: new Map(),
          cantidadConsultas: 0,
          totalConsultas: 0,
        });
      }

      const trab = trabajadoresMap.get(trabajadorId)!;

      // Contabilizar unidad de negocio
      if (unidadNegocio) {
        trab.unidadesNegocio.set(
          unidadNegocio,
          (trab.unidadesNegocio.get(unidadNegocio) || 0) + cantidad,
        );
      }

      // Caso Rosario consultas
      if (esRosarioConsulta) {
        trab.cantidadConsultas += cantidad;
        trab.totalConsultas = trab.cantidadConsultas * 10;
        // Registrar en detalle de servicios igual
        const key = item.producto_servicio_nombre;
        const existing = trab.serviciosDetalle.get(key);
        if (existing) {
          existing.cantidad += cantidad;
          existing.subtotal += cantidad * 10; // $10 por consulta
        } else {
          trab.serviciosDetalle.set(key, {
            nombre: key,
            cantidad,
            tipo: 'SERVICIO',
            subtotal: cantidad * 10,
          });
        }
        continue; // No suma a totales generales
      }

      // Subtotal sin descuento del -10%
      const subtotal = (precio * cantidad) - descuento;
      const subtotalConDesc = subtotal * 0.9;

      // Acumular por tipo
      const detalleMap = tipo === 'SERVICIO' ? trab.serviciosDetalle : trab.productosDetalle;
      const key = item.producto_servicio_nombre;
      const existing = detalleMap.get(key);
      if (existing) {
        existing.cantidad += cantidad;
        existing.subtotal += subtotal;
      } else {
        detalleMap.set(key, {
          nombre: key,
          cantidad,
          tipo,
          subtotal,
        });
      }

      if (tipo === 'SERVICIO') {
        trab.totalServicios += subtotal;
        totalGeneralServiciosSinDesc += subtotal;
        totalGeneralServiciosConDesc += subtotalConDesc;
      } else {
        trab.totalProductos += subtotal;
        totalGeneralProductosSinDesc += subtotal;
        totalGeneralProductosConDesc += subtotalConDesc;
      }
    }

    // ─── Ordenar trabajadores por nombre ─────────────────────────
    const trabajadores = Array.from(trabajadoresMap.values())
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // ─── Imprimir reporte por trabajador ─────────────────────────
    let totalComisionesGeneral = 0;

    for (const trab of trabajadores) {
      const comisionServicios = trab.totalServicios * COMISION_SERVICIOS;
      const comisionProductos = trab.totalProductos * COMISION_PRODUCTOS;
      const comisionTotal = comisionServicios + comisionProductos;
      totalComisionesGeneral += comisionTotal;

      console.log(doubleLine());
      console.log(`  EMPLEADO: ${trab.nombre.toUpperCase()}`);
      console.log(doubleLine());

      // ── Servicios por unidad de negocio ──
      if (trab.serviciosDetalle.size > 0) {
        console.log('\n  SERVICIOS');
        console.log('  ' + line('─', 88));

        // Agrupar servicios por unidad de negocio
        // Para eso necesitamos cruzar con los items originales
        // Usaremos la info de unidades de negocio del trabajador
        const serviciosArray = Array.from(trab.serviciosDetalle.values());

        // Organizar por unidad de negocio
        // Como no tenemos la unidad en el detalle, mostramos el listado directo
        console.log('  ' + pad('Servicio', 45) + padL('Cant', 8) + padL('Subtotal ($)', 18));
        console.log('  ' + line('─', 88));

        let totalServiciosItems = 0;
        for (const s of serviciosArray) {
          console.log(
            '  ' +
            pad(s.nombre, 45) +
            padL(String(s.cantidad), 8) +
            padL('$ ' + fmt(s.subtotal), 18),
          );
          totalServiciosItems += s.subtotal;
        }
        console.log('  ' + line('─', 88));
        console.log(
          '  ' +
          pad('TOTAL SERVICIOS (sin desc -10%)', 53) +
          padL('$ ' + fmt(totalServiciosItems), 18),
        );
      }

      // ── Productos ──
      if (trab.productosDetalle.size > 0) {
        console.log('\n  PRODUCTOS');
        console.log('  ' + line('─', 88));
        console.log('  ' + pad('Producto', 45) + padL('Cant', 8) + padL('Subtotal ($)', 18));
        console.log('  ' + line('─', 88));

        let totalProductosItems = 0;
        const productosArray = Array.from(trab.productosDetalle.values());
        for (const p of productosArray) {
          console.log(
            '  ' +
            pad(p.nombre, 45) +
            padL(String(p.cantidad), 8) +
            padL('$ ' + fmt(p.subtotal), 18),
          );
          totalProductosItems += p.subtotal;
        }
        console.log('  ' + line('─', 88));
        console.log(
          '  ' +
          pad('TOTAL PRODUCTOS (sin desc -10%)', 53) +
          padL('$ ' + fmt(totalProductosItems), 18),
        );
      }

      // ── Consultas (caso especial Rosario) ──
      if (trab.cantidadConsultas > 0) {
        console.log('\n  CONSULTAS (caso especial)');
        console.log('  ' + line('─', 88));
        console.log(`  Cantidad de consultas: ${trab.cantidadConsultas}`);
        console.log(`  Total consultas ($10 c/u): $ ${fmt(trab.totalConsultas)}`);
      }

      // ── Unidades de Negocio ──
      if (trab.unidadesNegocio.size > 0) {
        console.log('\n  UNIDADES DE NEGOCIO');
        console.log('  ' + line('─', 88));
        console.log('  ' + pad('Unidad de Negocio', 45) + padL('Cantidad', 8));
        console.log('  ' + line('─', 88));
        const unidades = Array.from(trab.unidadesNegocio.entries())
          .sort((a, b) => a[0].localeCompare(b[0]));
        for (const [nombre, cant] of unidades) {
          console.log('  ' + pad(nombre, 45) + padL(String(cant), 8));
        }
      }

      // ── Resumen del empleado ──
      console.log('\n  RESUMEN');
      console.log('  ' + line('─', 88));
      console.log('  ' + pad('Total Servicios (sin desc -10%)', 53) + padL('$ ' + fmt(trab.totalServicios), 18));
      console.log('  ' + pad('Total Productos (sin desc -10%)', 53) + padL('$ ' + fmt(trab.totalProductos), 18));
      console.log('  ' + line('─', 88));
      console.log('  ' + pad('Comision Servicios (30%)', 53) + padL('$ ' + fmt(comisionServicios), 18));
      console.log('  ' + pad('Comision Productos (10%)', 53) + padL('$ ' + fmt(comisionProductos), 18));
      console.log('  ' + pad('COMISION TOTAL', 53) + padL('$ ' + fmt(comisionTotal), 18));
      console.log('');
    }

    // ─── Totales generales ───────────────────────────────────────
    const totalSinDesc = totalGeneralServiciosSinDesc + totalGeneralProductosSinDesc;
    const totalConDesc = totalGeneralServiciosConDesc + totalGeneralProductosConDesc;

    console.log('\n' + doubleLine());
    console.log('  TOTALES GENERALES');
    console.log(doubleLine());

    console.log('\n  SERVICIOS');
    console.log('  ' + pad('Sin descuento (-10%)', 53) + padL('$ ' + fmt(totalGeneralServiciosSinDesc), 18));
    console.log('  ' + pad('Con descuento (-10%)', 53) + padL('$ ' + fmt(totalGeneralServiciosConDesc), 18));

    console.log('\n  PRODUCTOS');
    console.log('  ' + pad('Sin descuento (-10%)', 53) + padL('$ ' + fmt(totalGeneralProductosSinDesc), 18));
    console.log('  ' + pad('Con descuento (-10%)', 53) + padL('$ ' + fmt(totalGeneralProductosConDesc), 18));

    console.log('\n  ' + doubleLine(88));
    console.log('  ' + pad('TOTAL SIN DESCUENTO', 53) + padL('$ ' + fmt(totalSinDesc), 18));
    console.log('  ' + pad('TOTAL CON DESCUENTO (Saldo Caja)', 53) + padL('$ ' + fmt(totalConDesc), 18));
    console.log('  ' + doubleLine(88));
    console.log('  ' + pad('TOTAL COMISIONES A PAGAR', 53) + padL('$ ' + fmt(totalComisionesGeneral), 18));
    console.log('  ' + doubleLine(88));

    // ── Consultas Rosario resumen ──
    const rosario = trabajadores.find(t => t.cantidadConsultas > 0);
    if (rosario) {
      console.log('\n  NOTA: Consultas de Rosario (no incluidas en totales):');
      console.log(`  Cantidad: ${rosario.cantidadConsultas} | Total: $ ${fmt(rosario.totalConsultas)}`);
    }

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

calcularComisiones()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
