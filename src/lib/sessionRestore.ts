// src/lib/sessionRestore.ts
// Глобальный обработчик для восстановления сессии при возврате на вкладку

import { supabase } from './supabase';

let isRestoring = false;

/**
 * Восстанавливает сессию из localStorage и обновляет токен если нужно
 */
export async function restoreSession(): Promise<boolean> {
    if (isRestoring) return false;
    
    try {
        isRestoring = true;
        
        // Проверяем текущую сессию
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.warn('[SessionRestore] Error getting session:', error);
            return false;
        }
        
        // Если сессия есть и токен валидный - все ок
        if (session?.access_token) {
            // Проверяем, не истек ли токен (примерно, по времени создания)
            const expiresAt = session.expires_at;
            if (expiresAt) {
                const now = Math.floor(Date.now() / 1000);
                // Если токен истекает в течение 5 минут, обновляем его
                if (expiresAt - now < 300) {
                    console.log('[SessionRestore] Token expiring soon, refreshing...');
                    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                    if (refreshError) {
                        console.warn('[SessionRestore] Failed to refresh session:', refreshError);
                        return false;
                    }
                    return !!refreshData.session;
                }
            }
            return true;
        }
        
        // Если сессии нет, пробуем восстановить из localStorage
        // Supabase должен автоматически восстановить, но проверим
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Пользователь есть, но сессии нет - это странно, но попробуем обновить
            const { data: refreshData } = await supabase.auth.refreshSession();
            return !!refreshData?.session;
        }
        
        return false;
    } catch (error) {
        console.error('[SessionRestore] Error restoring session:', error);
        return false;
    } finally {
        isRestoring = false;
    }
}

/**
 * Инициализирует глобальные обработчики для восстановления сессии
 */
export function initSessionRestore() {
    if (typeof window === 'undefined') return;
    
    // Восстанавливаем сессию при возврате на вкладку
    const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
            await restoreSession();
        }
    };
    
    // Восстанавливаем сессию при фокусе на окно
    const handleFocus = async () => {
        await restoreSession();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Также слушаем изменения состояния авторизации Supabase
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
            console.log('[SessionRestore] Auth state changed:', event, { hasSession: !!session });
        }
    });
    
    // Восстанавливаем сессию сразу при инициализации
    restoreSession();
}

