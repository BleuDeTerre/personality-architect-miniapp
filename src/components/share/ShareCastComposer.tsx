"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { SHARE_PREVIEW_VERSION } from "@/lib/sharePreviewVersion";
import { useMiniApp } from '@/hooks/useMiniAppContext';
import { supabase } from '@/lib/supabase';
import CastSuccessModal from '@/components/CastSuccessModal';

export type CastTemplate = {
    key: string;
    title: string;
    label?: string;
    text: string;
    kind: string;
    previewParams?: Record<string, string | number | boolean>;
    targetPath?: string;
    publishMode?: 'auto' | 'confirm';
};

interface ShareCastComposerProps {
    templates: CastTemplate[];
    sectionTitle?: string;
    prepareHeaders?: () => Promise<Record<string, string>>;
}


export default function ShareCastComposer({
    templates,
    sectionTitle,
    prepareHeaders,
}: ShareCastComposerProps) {
    const { isSDKLoaded, actions } = useMiniApp();
    const [selectedKey, setSelectedKey] = useState<string>(() => templates[0]?.key ?? "");
    const [origin, setOrigin] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const composerOpenedRef = useRef(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [xpEarned, setXpEarned] = useState(0);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setOrigin(window.location.origin);
        }
    }, []);

    // Восстанавливаем сессию и проверяем опубликованный каст при возврате из композера
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const restoreSessionAndCheckCast = async () => {
            // Если композер был открыт и мы вернулись на вкладку
            if (composerOpenedRef.current && document.visibilityState === 'visible') {
                console.log('[ShareCastComposer] Restoring session after return from composer');

                // Увеличиваем задержку для новой вкладки/страницы
                await new Promise(resolve => setTimeout(resolve, 300));

                try {
                    // Сначала пробуем восстановить из localStorage/sessionStorage
                    const savedToken = localStorage.getItem('cast_composer_session') || sessionStorage.getItem('cast_composer_session');
                    const savedRefresh = localStorage.getItem('cast_composer_refresh') || '';

                    // Проверяем текущую сессию
                    let { data: { session }, error: sessionError } = await supabase.auth.getSession();

                    if (savedToken && (sessionError || !session?.access_token)) {
                        console.log('[ShareCastComposer] Session lost, trying to restore from saved token...');
                        try {
                            // Пробуем установить сессию из сохраненных токенов
                            const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
                                access_token: savedToken,
                                refresh_token: savedRefresh || savedToken,
                            });

                            if (!setSessionError && setSessionData.session) {
                                console.log('[ShareCastComposer] Session restored from saved token');
                                session = setSessionData.session;
                            } else {
                                throw new Error('setSession failed');
                            }
                        } catch (error) {
                            console.log('[ShareCastComposer] Saved token invalid, will try FID restore...');
                            // Очищаем невалидные токены
                            localStorage.removeItem('cast_composer_session');
                            localStorage.removeItem('cast_composer_refresh');
                            sessionStorage.removeItem('cast_composer_session');
                        }
                    }

                    if (sessionError || !session?.access_token) {
                        console.log('[ShareCastComposer] Session lost, attempting restore from FID...');

                        // Пробуем получить FID из localStorage
                        const savedFid = localStorage.getItem('user_fid');
                        if (savedFid) {
                            const fid = Number(savedFid);
                            if (fid && !isNaN(fid)) {
                                // Восстанавливаем сессию через API
                                const res = await fetch('/api/auth/miniapp-login', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ fid }),
                                });

                                if (res.ok) {
                                    const loginData = await res.json();
                                    if (loginData.access_token) {
                                        await supabase.auth.setSession({
                                            access_token: loginData.access_token,
                                            refresh_token: loginData.refresh_token || loginData.access_token,
                                        });
                                        console.log('[ShareCastComposer] Session restored successfully from FID');
                                        // Сохраняем новый токен
                                        sessionStorage.setItem('cast_composer_session', loginData.access_token);
                                    }
                                }
                            }
                        }
                    } else {
                        console.log('[ShareCastComposer] Session is still valid');
                    }

                    // Очищаем сохраненные токены после успешного восстановления
                    localStorage.removeItem('cast_composer_session');
                    localStorage.removeItem('cast_composer_refresh');
                    sessionStorage.removeItem('cast_composer_session');

                    // Проверяем, был ли опубликован каст (проверяем последнее событие share_cast_published)
                    // и начислен ли XP за него
                    if (session?.access_token) {
                        try {
                            const headers = prepareHeaders ? await prepareHeaders() : {};
                            const checkCastRes = await fetch('/api/share/check-recent-cast', {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${session.access_token}`,
                                    ...headers,
                                },
                            });

                            if (checkCastRes.ok) {
                                const castData = await checkCastRes.json();
                                if (castData.recent && castData.xpEarned) {
                                    // Показываем модальное окно успеха
                                    setXpEarned(castData.xpEarned);
                                    setShowSuccessModal(true);
                                }
                            }
                        } catch (error) {
                            console.warn('[ShareCastComposer] Failed to check recent cast:', error);
                        }
                    }
                } catch (error) {
                    console.error('[ShareCastComposer] Error restoring session:', error);
                } finally {
                    // Сбрасываем флаг после проверки
                    composerOpenedRef.current = false;
                    // Очищаем глобальный флаг композера
                    if (typeof window !== 'undefined') {
                        (window as any).__castComposerOpen = false;
                        localStorage.removeItem('cast_composer_opening');
                        sessionStorage.removeItem('cast_composer_opening');
                    }
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Увеличиваем задержку для новой вкладки/страницы
                setTimeout(restoreSessionAndCheckCast, 500);
            }
        };

        const handleFocus = () => {
            setTimeout(restoreSessionAndCheckCast, 500);
        };

        // Также слушаем событие pageshow (когда страница загружается из кэша)
        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
                // Страница была загружена из кэша (back/forward navigation)
                setTimeout(restoreSessionAndCheckCast, 500);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('pageshow', handlePageShow);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [prepareHeaders]);

    useEffect(() => {
        if (!templates.find(t => t.key === selectedKey) && templates.length > 0) {
            setSelectedKey(templates[0].key);
        }
    }, [templates, selectedKey]);

    const selected = useMemo(() => templates.find(t => t.key === selectedKey), [templates, selectedKey]);

    const buildPreviewUrl = useCallback(
        (template?: CastTemplate | null) => {
            if (!origin || !template) return null;
            const url = new URL(`${origin}/api/share/og`);
            url.searchParams.set("rev", SHARE_PREVIEW_VERSION);

            // Единая схема: передаем kind для всех категорий (для правильного определения цвета)
            if (template.kind) {
                url.searchParams.set("kind", template.kind);
            }

            if (template.previewParams) {
                Object.entries(template.previewParams).forEach(([key, value]) => {
                    if (value === undefined || value === null) return;
                    if (key === 'preset') {
                        url.searchParams.set("variant", String(value));
                    } else if (key === 'kind') {
                        // Если kind есть в previewParams, перезаписываем (но обычно он в template.kind)
                        url.searchParams.set("kind", String(value));
                    } else {
                        url.searchParams.set(key, String(value));
                    }
                });
            }
            return url.toString();
        },
        [origin],
    );

    const ogImageUrl = useMemo(() => buildPreviewUrl(selected), [buildPreviewUrl, selected]);

    async function publishCastDirectly(
        template: CastTemplate,
        opts?: { textOverride?: string; onSuccess?: () => void }
    ) {
        if (!origin || !prepareHeaders) {
            toast.error("Unable to publish cast", {
                description: "Origin or headers not available",
            });
            return;
        }

        const textToPublish = (opts?.textOverride ?? template.text).trim();
        if (!textToPublish) {
            toast.error("Unable to publish cast", { description: "Cast text cannot be empty." });
            return;
        }

        setLoading(true);

        try {
            const headers = await prepareHeaders();

            // Строим preview URL для эмбеда
            const previewUrl = buildPreviewUrl(template);
            if (!previewUrl) {
                throw new Error("Failed to build preview URL");
            }

            // Для Farcaster передаем HTML-страницу с OG-тегами
            let embedUrl = previewUrl.replace('/api/share/og', '/api/share/preview');

            // Добавляем targetPath в preview URL, если он указан
            if (template.targetPath) {
                const embedUrlObj = new URL(embedUrl);
                embedUrlObj.searchParams.set('targetPath', template.targetPath);
                embedUrl = embedUrlObj.toString();
            }

            // Публикуем каст через API
            const res = await fetch('/api/share/cast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({
                    kind: template.kind,
                    title: template.title,
                    text: textToPublish,
                    previewParams: template.previewParams,
                    embedUrl,
                    targetUrl: template.targetPath ? `${origin}${template.targetPath}` : undefined,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                const err = new Error(errorData.error || 'Failed to publish cast') as Error & { details?: string };
                err.details = typeof errorData.message === 'string' ? errorData.message : undefined;
                throw err;
            }

            const data = await res.json();

            // Показываем модальное окно успеха
            if (data.xpEarned) {
                setXpEarned(data.xpEarned);
                setShowSuccessModal(true);
            }

            toast.success("Cast published successfully!", {
                description: `+${data.xpEarned || 0} XP earned`,
            });

            opts?.onSuccess?.();
        } catch (error: any) {
            console.error('[ShareCastComposer] Failed to publish cast:', error);
            const description = error?.details ?? error?.message ?? "Unknown error";
            toast.error("Failed to publish cast", {
                description: description.length > 200 ? description.slice(0, 197) + "…" : description,
            });
        } finally {
            setLoading(false);
        }
    }

    function openComposer(template: CastTemplate, textOverride?: string) {
        if (!origin) {
            toast.error("Unable to open composer", {
                description: "Origin not available",
            });
            return;
        }

        const text = (textOverride ?? template.text).trim();
        if (!text) {
            toast.error("Cast text cannot be empty", { description: "Write something to share." });
            return;
        }

        setLoading(true);

        // Сохраняем сессию перед открытием композера
        const saveSessionBeforeOpen = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    // Сохраняем токен в localStorage для более надежного восстановления
                    localStorage.setItem('cast_composer_session', session.access_token);
                    localStorage.setItem('cast_composer_refresh', session.refresh_token || '');
                    sessionStorage.setItem('cast_composer_session', session.access_token);

                    // Сохраняем FID если его еще нет
                    if (!localStorage.getItem('user_fid')) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user?.user_metadata?.fid) {
                            localStorage.setItem('user_fid', String(user.user_metadata.fid));
                        }
                    }

                    console.log('[ShareCastComposer] Session saved before opening composer');
                } else {
                    console.warn('[ShareCastComposer] No session to save before opening composer');
                }
            } catch (error) {
                console.warn('[ShareCastComposer] Failed to save session before opening composer:', error);
            }
        };

        // Выполняем сохранение синхронно перед открытием
        saveSessionBeforeOpen().then(async () => {
            try {
                // Строим preview URL для эмбеда
                const previewUrl = buildPreviewUrl(template);
                if (!previewUrl) {
                    throw new Error("Failed to build preview URL");
                }

                // Для Farcaster передаем HTML-страницу с OG-тегами
                let embedUrl = previewUrl.replace('/api/share/og', '/api/share/preview');

                // Добавляем targetPath в preview URL, если он указан
                if (template.targetPath) {
                    const embedUrlObj = new URL(embedUrl);
                    embedUrlObj.searchParams.set('targetPath', template.targetPath);
                    embedUrl = embedUrlObj.toString();
                }

                // Строим URL композера Warpcast (текст может быть отредактирован в предкасте)
                const compose = new URL('https://warpcast.com/~/compose');
                compose.searchParams.set('text', text);
                compose.searchParams.append('embeds[]', embedUrl);

                const composeUrl = compose.toString();

                console.log('[ShareCastComposer] Opening Farcaster composer:', {
                    composeUrl,
                    text,
                    embedUrl,
                });

                // Устанавливаем флаг, что композер был открыт
                composerOpenedRef.current = true;

                // Устанавливаем глобальный флаг для предотвращения показа модалок авторизации
                // Используем localStorage вместо sessionStorage для сохранения при перезагрузке
                if (typeof window !== 'undefined') {
                    (window as any).__castComposerOpen = true;
                    localStorage.setItem('cast_composer_opening', Date.now().toString());
                    sessionStorage.setItem('cast_composer_opening', 'true');
                }

                // Открываем композер Farcaster через нативный SDK метод (каст публикует пользователь сам)
                // Это не открывает новое окно и не вызывает logout
                if (actions?.composeCast) {
                    console.log('[ShareCastComposer] Using native composeCast');
                    try {
                        await actions.composeCast({
                            text,
                            embeds: [embedUrl],
                        });
                    } catch (sdkError) {
                        console.warn('[ShareCastComposer] composeCast failed, falling back to link:', sdkError);
                        // Fallback: открываем через ссылку
                        const link = document.createElement('a');
                        link.href = composeUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                } else {
                    // Fallback для не-MiniApp окружения
                    console.log('[ShareCastComposer] No composeCast available, using link');
                    const link = document.createElement('a');
                    link.href = composeUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }

                // Логируем открытие композера
                if (prepareHeaders) {
                    prepareHeaders().then(headers => {
                        fetch('/api/share/log', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...headers,
                            },
                            body: JSON.stringify({
                                method: 'open_composer',
                                success: true,
                                kind: template.kind,
                            }),
                        }).catch(err => {
                            console.warn('[ShareCastComposer] Failed to log composer open:', err);
                        });
                    }).catch(err => {
                        console.warn('[ShareCastComposer] Failed to prepare headers for log:', err);
                    });
                }
            } catch (error: any) {
                console.error('[ShareCastComposer] Failed to open composer:', error);
                toast.error("Unable to open composer", {
                    description: error?.message ?? "Unknown error",
                });
            } finally {
                setLoading(false);
            }
        }).catch((error) => {
            console.error('[ShareCastComposer] Failed to save session:', error);
            setLoading(false);
        });
    }

    function handleShareRequest() {
        if (!selected) return;
        openComposer(selected);
    }

    if (templates.length === 0 || !selected) {
        return null;
    }

    const textLength = selected.text.length;
    const maxLength = 320;

    return (
        <>
            {showSuccessModal && (
                <CastSuccessModal
                    xpEarned={xpEarned}
                    onClose={() => setShowSuccessModal(false)}
                />
            )}
            <div className="space-y-4">
                {sectionTitle ? <h3 className="text-xl font-semibold text-white mb-4">{sectionTitle}</h3> : null}

                {/* Template selection buttons */}
                <div className="flex flex-wrap gap-2">
                    {templates.map(template => {
                        const active = template.key === selected.key;
                        return (
                            <button
                                key={template.key}
                                onClick={() => setSelectedKey(template.key)}
                                className={[
                                    "rounded-full px-3 py-2 text-sm font-medium transition",
                                    active
                                        ? "bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-lg shadow-[#8B5CF6]/40"
                                        : "border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10",
                                ].join(" ")}
                            >
                                {template.label ?? template.title}
                            </button>
                        );
                    })}
                </div>

                {/* Character counter and Share button */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">
                        {textLength} / {maxLength} characters
                    </span>
                    <button
                        onClick={handleShareRequest}
                        disabled={loading}
                        className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 py-3 text-center text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#8B5CF6]/40"
                    >
                        {loading ? "Opening…" : "Share"}
                    </button>
                </div>

                {/* PREVIEW Section */}
                {ogImageUrl && (
                    <div className="space-y-2">
                        <p className="text-sm uppercase tracking-wide text-white/60">PREVIEW</p>
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                            <Image
                                src={ogImageUrl}
                                alt="Cast preview"
                                width={600}
                                height={315}
                                className="w-full rounded-xl"
                                unoptimized
                            />
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}


