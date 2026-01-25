'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Компонент для автоматического восстановления сессии при возврате на вкладку
 * Решает проблему, когда пользователя выкидывает из аккаунта при переключении вкладок
 */
export default function SessionRestore() {
    const isRestoringRef = useRef(false);
    const restoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const restoreFromFid = async (): Promise<boolean> => {
            if (isRestoringRef.current) return false;
            
            // Проверяем, не открыт ли композер каста (с timeout в 2 минуты)
            const composerOpenTime = typeof window !== 'undefined' ? localStorage.getItem('cast_composer_opening') : null;
            const isComposerOpen = typeof window !== 'undefined' && (
                (window as any).__castComposerOpen === true ||
                sessionStorage.getItem('cast_composer_opening') === 'true' ||
                (composerOpenTime && (Date.now() - parseInt(composerOpenTime)) < 120000) // 2 минуты
            );
            
            if (isComposerOpen) {
                console.log('[SessionRestore] Skipping restore - cast composer is open');
                return false;
            }
            
            try {
                isRestoringRef.current = true;
                
                // Пробуем получить FID из localStorage
                const savedFid = localStorage.getItem('user_fid');
                if (!savedFid) {
                    console.log('[SessionRestore] No saved FID found');
                    return false;
                }

                const fid = Number(savedFid);
                if (!fid || isNaN(fid)) {
                    console.warn('[SessionRestore] Invalid FID:', savedFid);
                    return false;
                }

                console.log('[SessionRestore] Attempting to restore session from FID:', fid);

                // Пробуем залогиниться через API
                const res = await fetch('/api/auth/miniapp-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid }),
                });

                if (!res.ok) {
                    console.warn('[SessionRestore] Failed to login via API:', res.status);
                    return false;
                }

                const loginData = await res.json();
                if (!loginData.access_token) {
                    console.warn('[SessionRestore] No access token in login response');
                    return false;
                }

                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: loginData.access_token,
                    refresh_token: loginData.refresh_token || loginData.access_token,
                });

                if (sessionError) {
                    console.warn('[SessionRestore] Failed to set session:', sessionError);
                    return false;
                }

                // Проверяем, что сессия действительно установилась
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    console.warn('[SessionRestore] Session set but user not found');
                    return false;
                }

                console.log('[SessionRestore] Session restored successfully for user:', user.id);
                return true;
            } catch (error) {
                console.error('[SessionRestore] Error restoring from FID:', error);
                return false;
            } finally {
                isRestoringRef.current = false;
            }
        };

        const restoreSession = async () => {
            if (isRestoringRef.current) return;
            
            try {
                isRestoringRef.current = true;
                
                // Сначала проверяем валидность через getUser() - это более надежно
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                
                if (user && !userError) {
                    // Пользователь есть, проверяем сессию
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    
                    if (session?.access_token && !sessionError) {
                        // Проверяем срок действия токена
                        const expiresAt = session.expires_at;
                        if (expiresAt) {
                            const now = Math.floor(Date.now() / 1000);
                            const timeUntilExpiry = expiresAt - now;
                            
                            // Если токен истекает в течение 10 минут, обновляем его
                            if (timeUntilExpiry < 600) {
                                console.log('[SessionRestore] Token expiring soon, refreshing...');
                                const { error: refreshError } = await supabase.auth.refreshSession();
                                if (refreshError) {
                                    console.warn('[SessionRestore] Failed to refresh session:', refreshError);
                                    // Если refresh не удался, пробуем восстановить через FID
                                    await restoreFromFid();
                                }
                            }
                        }
                        return; // Сессия валидна
                    }
                }
                
                // Если пользователя нет или сессия невалидна, пробуем восстановить через FID
                console.log('[SessionRestore] No valid session found, attempting restore from FID');
                await restoreFromFid();
            } catch (error) {
                console.error('[SessionRestore] Error restoring session:', error);
                // При ошибке тоже пробуем восстановить через FID
                await restoreFromFid();
            } finally {
                isRestoringRef.current = false;
            }
        };

        // Восстанавливаем сессию при возврате на вкладку
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                // Увеличиваем задержку, чтобы дать браузеру время восстановить localStorage и состояние
                if (restoreTimeoutRef.current) {
                    clearTimeout(restoreTimeoutRef.current);
                }
                restoreTimeoutRef.current = setTimeout(() => {
                    restoreSession();
                }, 300);
            }
        };
        
        // Восстанавливаем сессию при фокусе на окно
        const handleFocus = async () => {
            if (restoreTimeoutRef.current) {
                clearTimeout(restoreTimeoutRef.current);
            }
            restoreTimeoutRef.current = setTimeout(() => {
                restoreSession();
            }, 300);
        };
        
        // Также слушаем изменения состояния авторизации Supabase
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[SessionRestore] Auth state changed:', event, { hasSession: !!session });
            
            if (event === 'SIGNED_OUT') {
                // Проверяем, не открыт ли композер каста (с timeout в 2 минуты)
                const composerOpenTime = typeof window !== 'undefined' ? localStorage.getItem('cast_composer_opening') : null;
                const isComposerOpen = typeof window !== 'undefined' && (
                    (window as any).__castComposerOpen === true ||
                    sessionStorage.getItem('cast_composer_opening') === 'true' ||
                    (composerOpenTime && (Date.now() - parseInt(composerOpenTime)) < 120000) // 2 минуты
                );
                
                if (isComposerOpen) {
                    console.log('[SessionRestore] User signed out but cast composer is open, skipping restore...');
                    return;
                }
                
                console.log('[SessionRestore] User signed out, trying to restore...');
                // Небольшая задержка перед восстановлением, чтобы дать время браузеру восстановить localStorage
                setTimeout(async () => {
                    await restoreFromFid();
                }, 200);
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('[SessionRestore] Token refreshed successfully');
            } else if (event === 'SIGNED_IN') {
                console.log('[SessionRestore] User signed in');
            }
        });
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        
        // Проверяем, был ли недавно открыт композер каста
        const composerOpenTime = localStorage.getItem('cast_composer_opening');
        if (composerOpenTime) {
            const timeSinceOpen = Date.now() - parseInt(composerOpenTime);
            // Если композер был открыт менее 2 минут назад, восстанавливаем сессию из сохраненных токенов
            if (timeSinceOpen < 120000) {
                console.log('[SessionRestore] Composer was recently opened, restoring from saved tokens...');
                const savedToken = localStorage.getItem('cast_composer_session');
                const savedRefresh = localStorage.getItem('cast_composer_refresh');
                if (savedToken) {
                    supabase.auth.setSession({
                        access_token: savedToken,
                        refresh_token: savedRefresh || savedToken,
                    }).then(({ error }) => {
                        if (error) {
                            console.warn('[SessionRestore] Failed to restore from composer tokens:', error);
                            // Очищаем невалидные токены
                            localStorage.removeItem('cast_composer_session');
                            localStorage.removeItem('cast_composer_refresh');
                            restoreFromFid();
                        } else {
                            console.log('[SessionRestore] Session restored from composer tokens');
                        }
                    });
                    return; // Пропускаем обычную проверку
                }
            } else {
                // Очищаем старый флаг композера
                localStorage.removeItem('cast_composer_opening');
                localStorage.removeItem('cast_composer_session');
                localStorage.removeItem('cast_composer_refresh');
            }
        }
        
        // Восстанавливаем сессию сразу при монтировании
        restoreSession();
        
        // Периодическая проверка сессии каждые 5 минут
        const intervalId = setInterval(() => {
            restoreSession();
        }, 5 * 60 * 1000);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            subscription.unsubscribe();
            clearInterval(intervalId);
            if (restoreTimeoutRef.current) {
                clearTimeout(restoreTimeoutRef.current);
            }
        };
    }, []);

    return null; // Компонент не рендерит ничего
}

