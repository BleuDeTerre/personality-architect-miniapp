"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SHARE_PREVIEW_VERSION } from "@/lib/sharePreviewVersion";

export type CastTemplate = {
    key: string;
    title: string;
    label?: string;
    text: string;
    kind: string;
    previewParams?: Record<string, string | number | boolean>;
    targetPath?: string;
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

    const previewUrl = useMemo(() => {
        if (!origin || !selected) return null;
        const url = new URL(`${origin}/api/share/preview`);
        url.searchParams.set("rev", SHARE_PREVIEW_VERSION);
        url.searchParams.set("kind", selected.kind);
        url.searchParams.set("title", selected.title);
        if (selected.targetPath) {
            url.searchParams.set("target", `${origin}${selected.targetPath}`);
        }
        if (selected.previewParams) {
            Object.entries(selected.previewParams).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                url.searchParams.set(key, String(value));
            });
        }
        return url.toString();
    }, [origin, selected]);

    const ogImageUrl = useMemo(() => {
        if (!origin || !selected) return null;
        const url = new URL(`${origin}/api/share/og`);
        url.searchParams.set("rev", SHARE_PREVIEW_VERSION);
        if (selected.previewParams?.preset) {
            url.searchParams.set("preset", String(selected.previewParams.preset));
        }
        if (selected.previewParams) {
            Object.entries(selected.previewParams).forEach(([key, value]) => {
                if (value === undefined || value === null || key === 'preset') return;
                url.searchParams.set(key, String(value));
            });
        }
        return url.toString();
    }, [origin, selected]);

    async function publishCast() {
        if (!selected) return;
        setLoading(true);
        try {
            const headers = {
                "Content-Type": "application/json",
                ...(prepareHeaders ? await prepareHeaders() : {}),
            };
            const res = await fetch("/api/share/cast", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    kind: selected.kind,
                    title: selected.title,
                    text: selected.text,
                    previewParams: selected.previewParams,
                    targetUrl: selected.targetPath ? `${origin}${selected.targetPath}` : undefined,
                }),
            });
            const data = (await res.json()) as ShareResponse;
            if (!res.ok) {
                if (data.fallback) {
                    toast.error("Auto cast failed. Open composer to share manually.", {
                        description: data.error ?? "Try again later.",
                        action: {
                            label: "Open",
                            onClick: () => window.open(data.fallback!, "_blank"),
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
                window.open(data.castUrl, "_blank");
            }
        } catch (error: any) {
            toast.error("Unable to publish cast", {
                description: error?.message ?? "Unknown error",
            });
        } finally {
            setLoading(false);
        }
    }

    if (templates.length === 0 || !selected) {
        return null;
    }

    const textLength = selected.text.length;
    const maxLength = 320;

    return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 space-y-4">
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
                    onClick={publishCast}
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
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <img
                            src={ogImageUrl}
                            alt="Cast preview"
                            className="w-full rounded-xl"
                        />
                    </div>
                </div>
            )}
        </section>
    );
}


