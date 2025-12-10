'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Компонент для автоматического восстановления сессии при возврате на вкладку
 * Решает проблему, когда пользователя выкидывает из аккаунта при переключении вкладок
 */
export default function SessionRestore() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isRestoring = false;

        const restoreSession = async () => {
            if (isRestoring) return;
            
            try {
                isRestoring = true;
                
                // Проверяем текущую сессию
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    console.warn('[SessionRestore] Error getting session:', error);
                    return;
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
                                // Если refresh не удался, пробуем восстановить через FID
                                await restoreFromFid();
                            }
                        }
                    }
                    return;
                }
                
                // Если сессии нет, пробуем восстановить через FID
                await restoreFromFid();
            } catch (error) {
                console.error('[SessionRestore] Error restoring session:', error);
            } finally {
                isRestoring = false;
            }
        };

        const restoreFromFid = async () => {
            try {
                // Пробуем получить FID из localStorage
                const savedFid = localStorage.getItem('user_fid');
                if (!savedFid) {
                    return; // Нет сохраненного FID, не можем восстановить
                }

                const fid = Number(savedFid);
                if (!fid || isNaN(fid)) {
                    return;
                }

                // Пробуем залогиниться через API
                const res = await fetch('/api/auth/farcaster-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid }),
                });

                if (!res.ok) {
                    console.warn('[SessionRestore] Failed to login via API:', res.status);
                    return;
                }

                const loginData = await res.json();
                if (loginData.access_token) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: loginData.access_token,
                        refresh_token: loginData.refresh_token || loginData.access_token,
                    });

                    if (sessionError) {
                        console.warn('[SessionRestore] Failed to set session:', sessionError);
                    } else {
                        console.log('[SessionRestore] Session restored successfully');
                    }
                }
            } catch (error) {
                console.warn('[SessionRestore] Error restoring from FID:', error);
            }
        };

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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                console.log('[SessionRestore] User signed out, trying to restore...');
                // Небольшая задержка перед восстановлением
                setTimeout(() => restoreFromFid(), 500);
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('[SessionRestore] Token refreshed successfully');
            }
        });
        
        // Восстанавливаем сессию сразу при монтировании
        restoreSession();
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            subscription.unsubscribe();
        };
    }, []);

    return null; // Компонент не рендерит ничего
}

