"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { SHARE_PREVIEW_VERSION } from "@/lib/sharePreviewVersion";
import { useMiniApp } from '@neynar/react';

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

    useEffect(() => {
        if (typeof window !== "undefined") {
            setOrigin(window.location.origin);
        }
    }, []);

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

    function openComposer(template: CastTemplate) {
        if (!origin) {
            toast.error("Unable to open composer", {
                description: "Origin not available",
            });
            return;
        }

        setLoading(true);

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

            // Строим URL композера Warpcast
            const compose = new URL('https://warpcast.com/~/compose');
            compose.searchParams.set('text', template.text);
            compose.searchParams.append('embeds[]', embedUrl);

            const composeUrl = compose.toString();

            console.log('[ShareCastComposer] Opening Farcaster composer:', {
                composeUrl,
                text: template.text,
                embedUrl,
            });

            // Открываем композер Farcaster
            if (actions?.openUrl) {
                actions.openUrl({ url: composeUrl });
            } else {
                window.open(composeUrl, '_blank');
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
    }

    function handleShareRequest() {
        if (!selected) return;
        // Всегда открываем композер Farcaster с готовым текстом и картинкой
        openComposer(selected);
    }

    if (templates.length === 0 || !selected) {
        return null;
    }

    const textLength = selected.text.length;
    const maxLength = 320;

    return (
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
                    {loading ? "Opening…" : "Share to Farcaster"}
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
    );
}


