-- ============================================================================
-- ROLLBACK: Revertir Consolidación de Métodos de Pago
-- ============================================================================
-- Fecha: 2025-10-07
-- Descripción: Este script revierte la migración de métodos de pago,
-- restaurando los métodos de pago originales de los items y eliminando
-- los métodos de pago consolidados a nivel de comanda.
-- ============================================================================
-- ⚠️  ADVERTENCIA: Solo ejecutar si necesitas revertir la migración
-- ============================================================================

BEGIN;

-- Paso 1: Contar qué se va a revertir
-- ============================================================================
DO $$
DECLARE
    metodos_items_eliminados INTEGER;
    metodos_comanda_a_eliminar INTEGER;
BEGIN
    -- Contar métodos de pago de items que están marcados como eliminados
    SELECT COUNT(*) INTO metodos_items_eliminados
    FROM metodos_pago
    WHERE "itemComandaId" IS NOT NULL
      AND "deletedAt" IS NOT NULL;
    
    -- Contar métodos de pago consolidados en comandas (creados después de la migración)
    SELECT COUNT(*) INTO metodos_comanda_a_eliminar
    FROM metodos_pago
    WHERE "comandaId" IS NOT NULL
      AND "itemComandaId" IS NULL
      AND "deletedAt" IS NULL
      AND "createdAt" >= '2025-10-07';
    
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ⚠️  ROLLBACK - REVERTIR MIGRACIÓN DE MÉTODOS DE PAGO            ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Métodos de pago de items a restaurar: %                         ║', LPAD(metodos_items_eliminados::TEXT, 5, ' ');
    RAISE NOTICE '║  Métodos de pago consolidados a eliminar: %                      ║', LPAD(metodos_comanda_a_eliminar::TEXT, 5, ' ');
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
END $$;

-- Paso 2: Restaurar métodos de pago originales de items (quitar soft delete)
-- ============================================================================
UPDATE metodos_pago
SET 
    "deletedAt" = NULL,
    "updatedAt" = NOW()
WHERE "itemComandaId" IS NOT NULL
  AND "deletedAt" IS NOT NULL;

-- Mostrar resultado de la restauración
DO $$
DECLARE
    restaurados INTEGER;
BEGIN
    SELECT COUNT(*) INTO restaurados
    FROM metodos_pago
    WHERE "itemComandaId" IS NOT NULL
      AND "deletedAt" IS NULL;
    
    RAISE NOTICE '✅ Métodos de pago de items restaurados: %', restaurados;
    RAISE NOTICE '';
END $$;

-- Paso 3: Eliminar métodos de pago consolidados de comandas
-- ============================================================================
-- Solo eliminamos los que fueron creados después de la fecha de migración
-- y que no tienen itemComandaId (son consolidados)

DELETE FROM metodos_pago
WHERE "comandaId" IS NOT NULL
  AND "itemComandaId" IS NULL
  AND "createdAt" >= '2025-10-07'
  AND "deletedAt" IS NULL;

-- Mostrar resultado de la eliminación
DO $$
DECLARE
    eliminados INTEGER;
BEGIN
    GET DIAGNOSTICS eliminados = ROW_COUNT;
    RAISE NOTICE '🗑️  Métodos de pago consolidados eliminados: %', eliminados;
    RAISE NOTICE '';
END $$;

-- Paso 4: Validación final
-- ============================================================================
DO $$
DECLARE
    metodos_items INTEGER;
    metodos_comanda INTEGER;
BEGIN
    -- Contar métodos de pago activos en items
    SELECT COUNT(*) INTO metodos_items
    FROM metodos_pago
    WHERE "itemComandaId" IS NOT NULL
      AND "deletedAt" IS NULL;
    
    -- Contar métodos de pago activos en comandas (consolidados)
    SELECT COUNT(*) INTO metodos_comanda
    FROM metodos_pago
    WHERE "comandaId" IS NOT NULL
      AND "itemComandaId" IS NULL
      AND "deletedAt" IS NULL
      AND "createdAt" >= '2025-10-07';
    
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ✅ ROLLBACK COMPLETADO EXITOSAMENTE                              ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Métodos de pago activos en items: %                             ║', LPAD(metodos_items::TEXT, 5, ' ');
    RAISE NOTICE '║  Métodos de pago consolidados restantes: %                       ║', LPAD(metodos_comanda::TEXT, 5, ' ');
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    
    IF metodos_comanda > 0 THEN
        RAISE WARNING 'Todavía hay % métodos de pago consolidados. Verifica si son anteriores a la migración.', metodos_comanda;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- FIN DEL ROLLBACK
-- ============================================================================

-- Para verificar el estado después del rollback:
-- ============================================================================

-- Ver métodos de pago en items:
-- SELECT 
--     c.numero as comanda,
--     ic.nombre as item,
--     mp.tipo,
--     mp.moneda,
--     mp.monto_final,
--     mp."createdAt"
-- FROM metodos_pago mp
-- INNER JOIN item_comanda ic ON ic.id = mp."itemComandaId"
-- INNER JOIN comandas c ON c.id = ic.comanda_id
-- WHERE mp."itemComandaId" IS NOT NULL
--   AND mp."deletedAt" IS NULL
-- ORDER BY c.numero, ic.nombre;



