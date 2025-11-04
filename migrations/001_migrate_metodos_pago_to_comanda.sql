-- ============================================================================
-- MIGRACIÓN: Consolidar Métodos de Pago de Items a Comandas
-- ============================================================================
-- Fecha: 2025-10-07
-- Descripción: Esta migración mueve todos los métodos de pago que están 
-- asociados a items individuales y los consolida a nivel de comanda,
-- agrupándolos por tipo de pago y moneda.
-- ============================================================================

BEGIN;

-- Paso 1: Crear tabla temporal con los datos agrupados
-- ============================================================================
CREATE TEMP TABLE metodos_pago_consolidados AS
WITH metodos_items AS (
    -- Obtener todos los métodos de pago de items con su comanda
    SELECT 
        mp.id as metodo_pago_id,
        mp.tipo,
        mp.monto,
        mp.recargo_porcentaje,
        mp.descuento_global_porcentaje,
        mp.monto_final,
        mp.moneda,
        mp."createdAt",
        mp."itemComandaId",
        ic.comanda_id as comanda_id
    FROM metodos_pago mp
    INNER JOIN item_comanda ic ON ic.id = mp."itemComandaId"
    WHERE mp."itemComandaId" IS NOT NULL
      AND mp."deletedAt" IS NULL
      AND ic."deletedAt" IS NULL
),
agrupados AS (
    -- Agrupar por comanda, tipo de pago y moneda
    SELECT 
        comanda_id,
        tipo,
        moneda,
        SUM(monto) as monto_total,
        SUM(monto_final) as monto_final_total,
        AVG(recargo_porcentaje) as recargo_porcentaje_promedio,
        AVG(descuento_global_porcentaje) as descuento_global_porcentaje_promedio,
        MIN("createdAt") as fecha_creacion_mas_antigua,
        COUNT(*) as cantidad_items,
        array_agg(metodo_pago_id) as ids_metodos_originales
    FROM metodos_items
    GROUP BY comanda_id, tipo, moneda
)
SELECT 
    gen_random_uuid() as nuevo_id,
    comanda_id,
    tipo,
    moneda,
    monto_total,
    monto_final_total,
    recargo_porcentaje_promedio,
    descuento_global_porcentaje_promedio,
    fecha_creacion_mas_antigua,
    cantidad_items,
    ids_metodos_originales
FROM agrupados;

-- Mostrar resumen de lo que se va a migrar
-- ============================================================================
DO $$
DECLARE
    total_items INTEGER;
    total_consolidados INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_items 
    FROM unnest((SELECT array_agg(ids_metodos_originales) FROM metodos_pago_consolidados));
    
    SELECT COUNT(*) INTO total_consolidados 
    FROM metodos_pago_consolidados;
    
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  RESUMEN DE MIGRACIÓN DE MÉTODOS DE PAGO                          ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Métodos de pago en items a migrar: %                             ║', LPAD(total_items::TEXT, 5, ' ');
    RAISE NOTICE '║  Métodos de pago consolidados a crear: %                          ║', LPAD(total_consolidados::TEXT, 5, ' ');
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════╝';
END $$;

-- Paso 2: Insertar los nuevos métodos de pago consolidados a nivel de comanda
-- ============================================================================
INSERT INTO metodos_pago (
    id,
    tipo,
    moneda,
    monto,
    monto_final,
    recargo_porcentaje,
    descuento_global_porcentaje,
    "comandaId",
    "itemComandaId",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT 
    nuevo_id,
    tipo,
    moneda,
    monto_total,
    monto_final_total,
    recargo_porcentaje_promedio,
    descuento_global_porcentaje_promedio,
    comanda_id,
    NULL, -- No está asociado a ningún item específico
    fecha_creacion_mas_antigua,
    NOW(),
    NULL
FROM metodos_pago_consolidados;

-- Mostrar detalles de cada consolidación
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    comanda_numero TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  DETALLE DE CONSOLIDACIONES';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    
    FOR rec IN 
        SELECT 
            mpc.*,
            c.numero as comanda_numero
        FROM metodos_pago_consolidados mpc
        INNER JOIN comandas c ON c.id = mpc.comanda_id
        ORDER BY c.numero, mpc.tipo
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '🔹 Comanda: %', rec.comanda_numero;
        RAISE NOTICE '   Tipo: % | Moneda: %', rec.tipo, rec.moneda;
        RAISE NOTICE '   Monto consolidado: %', rec.monto_final_total;
        RAISE NOTICE '   Items consolidados: %', rec.cantidad_items;
        RAISE NOTICE '   Fecha original: %', rec.fecha_creacion_mas_antigua;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END $$;

-- Paso 3: Marcar como eliminados (soft delete) los métodos de pago originales
-- ============================================================================
UPDATE metodos_pago
SET 
    "deletedAt" = NOW(),
    "updatedAt" = NOW()
WHERE id IN (
    SELECT unnest(ids_metodos_originales)
    FROM metodos_pago_consolidados
);

-- Mostrar cantidad de registros marcados como eliminados
-- ============================================================================
DO $$
DECLARE
    total_eliminados INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_eliminados 
    FROM unnest((SELECT array_agg(ids_metodos_originales) FROM metodos_pago_consolidados));
    
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  Métodos de pago originales marcados como eliminados: %', total_eliminados;
    RAISE NOTICE '';
END $$;

-- Paso 4: Validación final
-- ============================================================================
DO $$
DECLARE
    metodos_comanda INTEGER;
    comandas_migradas INTEGER;
BEGIN
    -- Contar métodos de pago a nivel de comanda
    SELECT COUNT(*) INTO metodos_comanda
    FROM metodos_pago
    WHERE "comandaId" IS NOT NULL
      AND "itemComandaId" IS NULL
      AND "deletedAt" IS NULL;
    
    -- Contar comandas con métodos de pago
    SELECT COUNT(DISTINCT "comandaId") INTO comandas_migradas
    FROM metodos_pago
    WHERE "comandaId" IS NOT NULL
      AND "itemComandaId" IS NULL
      AND "deletedAt" IS NULL;
    
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE                             ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Total métodos de pago en comandas: %                            ║', LPAD(metodos_comanda::TEXT, 5, ' ');
    RAISE NOTICE '║  Total comandas con métodos de pago: %                           ║', LPAD(comandas_migradas::TEXT, 5, ' ');
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
END $$;

-- Limpiar tabla temporal
DROP TABLE IF EXISTS metodos_pago_consolidados;

COMMIT;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

-- Para verificar los resultados, puedes ejecutar estas consultas:
-- ============================================================================

-- Ver métodos de pago consolidados por comanda:
-- SELECT 
--     c.numero as comanda,
--     mp.tipo,
--     mp.moneda,
--     mp.monto_final,
--     mp."createdAt"
-- FROM metodos_pago mp
-- INNER JOIN comandas c ON c.id = mp."comandaId"
-- WHERE mp."comandaId" IS NOT NULL
--   AND mp."itemComandaId" IS NULL
--   AND mp."deletedAt" IS NULL
-- ORDER BY c.numero, mp.tipo;

-- Ver resumen por comanda:
-- SELECT 
--     c.numero as comanda,
--     COUNT(*) as cantidad_metodos_pago,
--     SUM(mp.monto_final) as total
-- FROM metodos_pago mp
-- INNER JOIN comandas c ON c.id = mp."comandaId"
-- WHERE mp."comandaId" IS NOT NULL
--   AND mp."itemComandaId" IS NULL
--   AND mp."deletedAt" IS NULL
-- GROUP BY c.numero
-- ORDER BY c.numero;

