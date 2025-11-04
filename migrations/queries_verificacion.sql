-- ============================================================================
-- CONSULTAS DE VERIFICACIÓN PARA LA MIGRACIÓN DE MÉTODOS DE PAGO
-- ============================================================================
-- Ejecuta estas consultas ANTES y DESPUÉS de la migración para verificar
-- que todo funcionó correctamente
-- ============================================================================

-- ============================================================================
-- ANTES DE LA MIGRACIÓN - Estado actual
-- ============================================================================

-- 1. Ver todos los métodos de pago actuales en items
SELECT 
    'Métodos de pago en ITEMS' as tipo,
    COUNT(*) as cantidad,
    SUM(mp.monto_final) as monto_total
FROM metodos_pago mp
WHERE mp."itemComandaId" IS NOT NULL
  AND mp."deletedAt" IS NULL;

-- 2. Ver todos los métodos de pago actuales en comandas
SELECT 
    'Métodos de pago en COMANDAS' as tipo,
    COUNT(*) as cantidad,
    SUM(mp.monto_final) as monto_total
FROM metodos_pago mp
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL;

-- 3. Detalle de métodos de pago por comanda ANTES de migrar
SELECT 
    c.numero as comanda,
    ic.nombre as item,
    mp.tipo as tipo_pago,
    mp.moneda,
    mp.monto_final,
    mp."createdAt"
FROM metodos_pago mp
INNER JOIN item_comanda ic ON ic.id = mp."itemComandaId"
INNER JOIN comandas c ON c.id = ic.comanda_id
WHERE mp."deletedAt" IS NULL
  AND ic."deletedAt" IS NULL
ORDER BY c.numero, ic.nombre, mp.tipo;

-- 4. Resumen: ¿Cuántos métodos de pago se consolidarán?
SELECT 
    c.numero as comanda,
    mp.tipo as tipo_pago,
    mp.moneda,
    COUNT(*) as cantidad_items,
    SUM(mp.monto_final) as monto_total_consolidado
FROM metodos_pago mp
INNER JOIN item_comanda ic ON ic.id = mp."itemComandaId"
INNER JOIN comandas c ON c.id = ic.comanda_id
WHERE mp."deletedAt" IS NULL
  AND ic."deletedAt" IS NULL
GROUP BY c.numero, mp.tipo, mp.moneda
ORDER BY c.numero, mp.tipo;

-- 5. Comandas que tienen items con métodos de pago
SELECT 
    c.numero as comanda,
    COUNT(DISTINCT ic.id) as total_items,
    COUNT(mp.id) as total_metodos_pago,
    SUM(mp.monto_final) as monto_total
FROM comandas c
INNER JOIN item_comanda ic ON ic.comanda_id = c.id
LEFT JOIN metodos_pago mp ON mp."itemComandaId" = ic.id AND mp."deletedAt" IS NULL
WHERE c."deletedAt" IS NULL
  AND ic."deletedAt" IS NULL
GROUP BY c.numero, c.id
HAVING COUNT(mp.id) > 0
ORDER BY c.numero;

-- ============================================================================
-- DESPUÉS DE LA MIGRACIÓN - Verificación
-- ============================================================================

-- 6. Ver todos los métodos de pago CONSOLIDADOS en comandas
SELECT 
    c.numero as comanda,
    mp.tipo as tipo_pago,
    mp.moneda,
    mp.monto as monto,
    mp.monto_final as monto_final,
    mp.recargo_porcentaje,
    mp.descuento_global_porcentaje,
    mp."createdAt" as fecha_original
FROM metodos_pago mp
INNER JOIN comandas c ON c.id = mp."comandaId"
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
ORDER BY c.numero, mp.tipo, mp.moneda;

-- 7. Comparación: Total de montos ANTES vs DESPUÉS
-- Esta consulta debe dar el mismo resultado antes y después
SELECT 
    'TOTAL GENERAL' as concepto,
    SUM(mp.monto_final) as monto_total
FROM metodos_pago mp
WHERE mp."deletedAt" IS NULL;

-- 8. Métodos de pago de items marcados como eliminados
SELECT 
    'Métodos de pago de items eliminados (soft delete)' as tipo,
    COUNT(*) as cantidad,
    SUM(mp.monto_final) as monto_total
FROM metodos_pago mp
WHERE mp."itemComandaId" IS NOT NULL
  AND mp."deletedAt" IS NOT NULL;

-- 9. Resumen por comanda DESPUÉS de la migración
SELECT 
    c.numero as comanda,
    COUNT(mp.id) as cantidad_metodos_pago,
    SUM(mp.monto_final) as total_comanda,
    STRING_AGG(DISTINCT mp.tipo || ' ' || mp.moneda, ', ') as tipos_pago
FROM metodos_pago mp
INNER JOIN comandas c ON c.id = mp."comandaId"
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
GROUP BY c.numero, c.id
ORDER BY c.numero;

-- 10. Verificar que no se perdieron datos
-- Esta consulta compara el total antes y después de la migración
WITH antes AS (
    SELECT 
        SUM(mp.monto_final) as total
    FROM metodos_pago mp
    WHERE mp."deletedAt" IS NULL
        OR mp."itemComandaId" IS NOT NULL -- Incluye los marcados como eliminados que eran de items
),
despues_items_eliminados AS (
    SELECT 
        SUM(mp.monto_final) as total
    FROM metodos_pago mp
    WHERE mp."itemComandaId" IS NOT NULL
      AND mp."deletedAt" IS NOT NULL
),
despues_comandas AS (
    SELECT 
        SUM(mp.monto_final) as total
    FROM metodos_pago mp
    WHERE mp."comandaId" IS NOT NULL
      AND mp."itemComandaId" IS NULL
      AND mp."deletedAt" IS NULL
)
SELECT 
    despues_items_eliminados.total as "Total Items (eliminados)",
    despues_comandas.total as "Total Comandas (nuevos)",
    (despues_items_eliminados.total + despues_comandas.total) as "Total combinado",
    CASE 
        WHEN ABS((despues_items_eliminados.total + despues_comandas.total) - antes.total) < 0.01 
        THEN '✅ OK - Los montos coinciden'
        ELSE '❌ ERROR - Los montos NO coinciden'
    END as verificacion
FROM antes, despues_items_eliminados, despues_comandas;

-- 11. Ver historial de cambios (si tienes auditoría)
-- Descomentar si tienes tabla de auditoría
/*
SELECT 
    a.accion,
    a.tabla,
    a.registro_id,
    a."createdAt",
    a.usuario
FROM auditoria a
WHERE a.tabla = 'metodos_pago'
  AND a."createdAt" >= CURRENT_DATE
ORDER BY a."createdAt" DESC;
*/

-- 12. Comandas con mayor cantidad de métodos de pago consolidados
SELECT 
    c.numero as comanda,
    COUNT(mp.id) as cantidad_metodos,
    SUM(mp.monto_final) as total,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'tipo', mp.tipo,
            'moneda', mp.moneda,
            'monto', mp.monto_final
        )
    ) as detalle_pagos
FROM metodos_pago mp
INNER JOIN comandas c ON c.id = mp."comandaId"
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
GROUP BY c.numero, c.id
ORDER BY COUNT(mp.id) DESC, SUM(mp.monto_final) DESC
LIMIT 10;

-- 13. Distribución de tipos de pago DESPUÉS de la migración
SELECT 
    mp.tipo as tipo_pago,
    mp.moneda,
    COUNT(*) as cantidad_comandas,
    SUM(mp.monto_final) as monto_total,
    AVG(mp.monto_final) as monto_promedio,
    MIN(mp.monto_final) as monto_minimo,
    MAX(mp.monto_final) as monto_maximo
FROM metodos_pago mp
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
GROUP BY mp.tipo, mp.moneda
ORDER BY mp.tipo, mp.moneda;

-- 14. Comandas con métodos de pago en múltiples monedas
SELECT 
    c.numero as comanda,
    COUNT(DISTINCT mp.moneda) as cantidad_monedas,
    STRING_AGG(DISTINCT mp.moneda, ', ') as monedas,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'tipo', mp.tipo,
            'moneda', mp.moneda,
            'monto', mp.monto_final
        )
    ) as detalle
FROM metodos_pago mp
INNER JOIN comandas c ON c.id = mp."comandaId"
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
GROUP BY c.numero, c.id
HAVING COUNT(DISTINCT mp.moneda) > 1
ORDER BY c.numero;

-- 15. Verificar fechas de creación (deben mantener la fecha original más antigua)
SELECT 
    c.numero as comanda,
    mp.tipo as tipo_pago,
    mp.moneda,
    mp."createdAt" as fecha_metodo_consolidado,
    MIN(mp_items."createdAt") as fecha_mas_antigua_items
FROM metodos_pago mp
INNER JOIN comandas c ON c.id = mp."comandaId"
LEFT JOIN item_comanda ic ON ic.comanda_id = c.id
LEFT JOIN metodos_pago mp_items ON mp_items."itemComandaId" = ic.id 
    AND mp_items.tipo = mp.tipo 
    AND mp_items.moneda = mp.moneda
    AND mp_items."deletedAt" IS NOT NULL
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
GROUP BY c.numero, mp.tipo, mp.moneda, mp."createdAt"
ORDER BY c.numero;

-- ============================================================================
-- CONSULTAS DE DIAGNÓSTICO
-- ============================================================================

-- 16. Verificar integridad: Items huérfanos (sin comanda)
SELECT 
    COUNT(*) as items_huerfanos
FROM item_comanda ic
WHERE ic.comanda_id IS NULL
  AND ic."deletedAt" IS NULL;

-- 17. Verificar integridad: Métodos de pago huérfanos
SELECT 
    COUNT(*) as metodos_huerfanos
FROM metodos_pago mp
WHERE mp."comandaId" IS NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL;

-- 18. Estado general del sistema
SELECT 
    (SELECT COUNT(*) FROM comandas WHERE "deletedAt" IS NULL) as total_comandas,
    (SELECT COUNT(*) FROM item_comanda WHERE "deletedAt" IS NULL) as total_items,
    (SELECT COUNT(*) FROM metodos_pago WHERE "deletedAt" IS NULL) as total_metodos_pago_activos,
    (SELECT COUNT(*) FROM metodos_pago WHERE "comandaId" IS NOT NULL AND "itemComandaId" IS NULL AND "deletedAt" IS NULL) as metodos_en_comandas,
    (SELECT COUNT(*) FROM metodos_pago WHERE "itemComandaId" IS NOT NULL AND "deletedAt" IS NULL) as metodos_en_items_activos,
    (SELECT COUNT(*) FROM metodos_pago WHERE "itemComandaId" IS NOT NULL AND "deletedAt" IS NOT NULL) as metodos_en_items_eliminados;

-- ============================================================================
-- CONSULTA FINAL: RESUMEN COMPLETO
-- ============================================================================

-- 19. Resumen ejecutivo de la migración
SELECT 
    '══════════════════════════════════════════════' as "RESUMEN DE MIGRACIÓN",
    '' as " ";

SELECT 
    'Comandas con métodos de pago' as concepto,
    COUNT(DISTINCT mp."comandaId") as cantidad
FROM metodos_pago mp
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
UNION ALL
SELECT 
    'Total métodos de pago consolidados' as concepto,
    COUNT(*) as cantidad
FROM metodos_pago mp
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL
UNION ALL
SELECT 
    'Métodos de items migrados (eliminados)' as concepto,
    COUNT(*) as cantidad
FROM metodos_pago mp
WHERE mp."itemComandaId" IS NOT NULL
  AND mp."deletedAt" IS NOT NULL
UNION ALL
SELECT 
    'Monto total consolidado' as concepto,
    SUM(mp.monto_final)::INTEGER as cantidad
FROM metodos_pago mp
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL;

