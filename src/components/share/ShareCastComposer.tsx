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

type ShareResponse = {
    hash?: string;
    castUrl?: string;
    previewUrl?: string;
    error?: string;
    fallback?: string;
};

export default function ShareCastComposer({
    templates,
    sectionTitle,
    prepareHeaders,
}: ShareCastComposerProps) {
    const { isSDKLoaded, actions } = useMiniApp();
    const [selectedKey, setSelectedKey] = useState<string>(() => templates[0]?.key ?? "");
    const [origin, setOrigin] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [confirmTemplate, setConfirmTemplate] = useState<CastTemplate | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

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
    const confirmPreviewUrl = useMemo(() => buildPreviewUrl(confirmTemplate), [buildPreviewUrl, confirmTemplate]);

    async function publishCast(template: CastTemplate) {
        setLoading(true);

        const isInMiniApp = isSDKLoaded && actions?.composeCast;
        const previewUrl = buildPreviewUrl(template);
        // Для Farcaster передаем HTML-страницу с OG-тегами (как в рабочей версии)
        const embedUrl = previewUrl ? previewUrl.replace('/api/share/og', '/api/share/preview') : null;

        console.log('[ShareCastComposer] Publishing cast:', {
            isInMiniApp,
            previewUrl,
            embedUrl,
            template: {
                key: template.key,
                kind: template.kind,
                previewParams: template.previewParams,
            },
        });

        try {
            // Пробуем нативный метод, если в Mini App
            if (isInMiniApp && actions.composeCast) {
                const embeds: string[] = [];

                // Добавляем HTML-страницу с OG-тегами (Farcaster сам загрузит og:image)
                if (embedUrl) {
                    embeds.push(embedUrl);
                    console.log('[ShareCastComposer] Using native composeCast with embed:', embedUrl);
                }

                // Добавляем второй embed с URL приложения для кнопки "Open in app"
                if (template.targetPath) {
                    const targetUrl = `${origin}${template.targetPath}`;
                    embeds.push(targetUrl);
                    console.log('[ShareCastComposer] Adding target URL for "Open in app":', targetUrl);
                }

                const embedsTuple = embeds.length > 0
                    ? (embeds.length === 1 ? [embeds[0]] as [string] : [embeds[0], embeds[1]] as [string, string])
                    : undefined;
                await actions.composeCast({
                    text: template.text,
                    embeds: embedsTuple,
                });

                // Логируем успешное использование нативного метода
                try {
                    await fetch('/api/share/log', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(prepareHeaders ? await prepareHeaders() : {}),
                        },
                        body: JSON.stringify({
                            method: 'native_composeCast',
                            success: true,
                            kind: template.kind,
                        }),
                    });
                } catch (logError) {
                    console.warn('[ShareCastComposer] Failed to log native share:', logError);
                }

                toast.success("Composer opened 🎉", {
                    description: "Edit and publish your cast in the composer.",
                });
                setLoading(false);
                return;
            }

            // Fallback: используем API метод
            const headers = {
                "Content-Type": "application/json",
                ...(prepareHeaders ? await prepareHeaders() : {}),
            };
            const res = await fetch("/api/share/cast", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    kind: template.kind,
                    title: template.title,
                    text: template.text,
                    previewParams: template.previewParams,
                    embedUrl: embedUrl, // Передаем HTML-страницу с OG-тегами
                    targetUrl: template.targetPath ? `${origin}${template.targetPath}` : undefined,
                }),
            });
            const data = (await res.json()) as ShareResponse;

            // Логируем использование API метода
            try {
                await fetch('/api/share/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(prepareHeaders ? await prepareHeaders() : {}),
                    },
                    body: JSON.stringify({
                        method: 'api_publishCast',
                        success: res.ok,
                        kind: template.kind,
                        error: res.ok ? undefined : (data.error ?? 'Unknown error'),
                    }),
                });
            } catch (logError) {
                console.warn('[ShareCastComposer] Failed to log API share:', logError);
            }

            if (!res.ok) {
                if (data.fallback) {
                    toast.error("Auto cast failed. Open composer to share manually.", {
                        description: data.error ?? "Try again later.",
                        action: {
                            label: "Open",
                            onClick: () => {
                                if (actions?.openUrl) {
                                    actions.openUrl({ url: data.fallback! });
                                } else {
                                    window.open(data.fallback!, '_blank');
                                }
                            },
                        },
                    });
                    return;
                }
                throw new Error(data.error ?? "Failed to publish");
            }
            toast.success("Cast published 🎉", {
                description: "Check Warpcast feed for your update.",
            });
            if (data.castUrl) {
                if (actions?.openUrl) {
                    await actions.openUrl({ url: data.castUrl });
                } else {
                    window.open(data.castUrl, '_blank');
                }
            }
        } catch (error: any) {
            toast.error("Unable to publish cast", {
                description: error?.message ?? "Unknown error",
            });
        } finally {
            setLoading(false);
        }
    }

    function handleShareRequest() {
        if (!selected) return;
        const mode = selected.publishMode ?? 'confirm';
        if (mode === 'confirm') {
            setConfirmTemplate(selected);
            return;
        }
        void publishCast(selected);
    }

    async function confirmPublish() {
        if (!confirmTemplate) return;
        setConfirmLoading(true);
        try {
            await publishCast(confirmTemplate);
            setConfirmTemplate(null);
        } finally {
            setConfirmLoading(false);
        }
    }

    function closeConfirm() {
        if (confirmLoading) return;
        setConfirmTemplate(null);
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
                    {loading ? "Publishing…" : "Share to Farcaster"}
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

            {confirmTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#101123] p-6 space-y-4 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-widest text-white/60">Confirm share</p>
                                <h3 className="text-2xl font-semibold text-white">{confirmTemplate.title}</h3>
                                <p className="text-white/70 mt-1">{confirmTemplate.text}</p>
                            </div>
                            <button
                                onClick={closeConfirm}
                                className="text-white/60 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                        {confirmPreviewUrl && (
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-3">
                                <Image
                                    src={confirmPreviewUrl}
                                    alt="Confirm preview"
                                    width={520}
                                    height={273}
                                    className="w-full rounded-xl"
                                    unoptimized
                                />
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={closeConfirm}
                                className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
                                disabled={confirmLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmPublish}
                                disabled={confirmLoading}
                                className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[#8B5CF6]/40 disabled:opacity-60"
                            >
                                {confirmLoading ? 'Publishing…' : 'Publish'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


