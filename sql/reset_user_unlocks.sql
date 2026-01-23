-- ============================================
-- Сброс разблокировок пользователя для тестирования
-- Удаляет только покупки (unlocks), аккаунт остается
-- ============================================

-- 1. Создать временную политику для удаления (только для тестирования)
-- Сначала удаляем политику, если она уже существует, потом создаем новую
DROP POLICY IF EXISTS "Users can delete own unlocks for testing" ON user_unlocks;

CREATE POLICY "Users can delete own unlocks for testing"
    ON user_unlocks FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Удалить все разблокировки для текущего пользователя (auth.uid())
-- Это вернет вас к бесплатному плану
DELETE FROM user_unlocks
WHERE user_id = auth.uid();

-- 3. Проверка: посмотреть текущие разблокировки (должно быть пусто)
SELECT * FROM user_unlocks
WHERE user_id = auth.uid();

-- ============================================
-- После тестирования можно удалить временную политику:
-- DROP POLICY IF EXISTS "Users can delete own unlocks for testing" ON user_unlocks;
-- ============================================
