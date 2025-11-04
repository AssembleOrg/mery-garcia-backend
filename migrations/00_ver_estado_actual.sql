-- ============================================================================
-- CONSULTA SIMPLE: Ver el estado actual de tu base de datos
-- ============================================================================
-- Ejecuta esto PRIMERO para saber si tienes datos para migrar
-- ============================================================================

-- Paso 1: Ver si tienes métodos de pago en ITEMS (esto es lo que se va a migrar)
-- ============================================================================
SELECT 
    '📊 MÉTODOS DE PAGO EN ITEMS (a migrar)' as info,
    COUNT(*) as cantidad,
    COALESCE(SUM(mp.monto_final), 0) as monto_total
FROM metodos_pago mp
WHERE mp."itemComandaId" IS NOT NULL
  AND mp."deletedAt" IS NULL;

-- Paso 2: Ver si ya tienes métodos de pago en COMANDAS
-- ============================================================================
SELECT 
    '📊 MÉTODOS DE PAGO EN COMANDAS (ya consolidados)' as info,
    COUNT(*) as cantidad,
    COALESCE(SUM(mp.monto_final), 0) as monto_total
FROM metodos_pago mp
WHERE mp."comandaId" IS NOT NULL
  AND mp."itemComandaId" IS NULL
  AND mp."deletedAt" IS NULL;

-- Paso 3: Ver TODOS los métodos de pago (sin importar si están en items o comandas)
-- ============================================================================
SELECT 
    '📊 TODOS LOS MÉTODOS DE PAGO' as info,
    COUNT(*) as cantidad,
    COALESCE(SUM(mp.monto_final), 0) as monto_total
FROM metodos_pago mp
WHERE mp."deletedAt" IS NULL;

-- Paso 4: Ver estructura de la tabla metodos_pago
-- ============================================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'metodos_pago'
ORDER BY ordinal_position;

-- Paso 5: Ver los primeros 10 métodos de pago (para entender la estructura)
-- ============================================================================
SELECT 
    mp.id,
    mp.tipo,
    mp.moneda,
    mp.monto_final,
    mp."itemComandaId",
    mp."comandaId",
    mp."createdAt",
    mp."deletedAt",
    CASE 
        WHEN mp."itemComandaId" IS NOT NULL THEN '🔵 En Item'
        WHEN mp."comandaId" IS NOT NULL THEN '🟢 En Comanda'
        ELSE '🔴 Huérfano'
    END as ubicacion
FROM metodos_pago mp
ORDER BY mp."createdAt" DESC
LIMIT 10;

-- Paso 6: Verificar si existen las relaciones necesarias
-- ============================================================================
SELECT 
    c.numero as comanda,
    ic.nombre as item,
    ic.id as item_id,
    COUNT(mp.id) as metodos_pago
FROM comandas c
INNER JOIN item_comanda ic ON ic.comanda_id = c.id
LEFT JOIN metodos_pago mp ON mp."itemComandaId" = ic.id AND mp."deletedAt" IS NULL
WHERE c."deletedAt" IS NULL
  AND ic."deletedAt" IS NULL
GROUP BY c.numero, ic.nombre, ic.id
HAVING COUNT(mp.id) > 0
ORDER BY c.numero
LIMIT 20;

-- ============================================================================
-- INTERPRETACIÓN DE RESULTADOS:
-- ============================================================================
-- 
-- Si en el Paso 1 ves cantidad > 0:
--   ✅ Tienes datos para migrar, puedes ejecutar la migración
--
-- Si en el Paso 1 ves cantidad = 0:
--   ⚠️  NO tienes métodos de pago en items
--   Posibles razones:
--   - Ya ejecutaste la migración anteriormente
--   - Los métodos de pago siempre estuvieron en comandas
--   - No hay métodos de pago en tu sistema
--
-- Si en el Paso 2 ves cantidad > 0:
--   ℹ️  Ya tienes métodos de pago en comandas
--   (estos no se verán afectados por la migración)
--
-- Si en el Paso 5 no ves ningún registro:
--   ⚠️  No tienes métodos de pago en tu base de datos
--
-- ============================================================================

