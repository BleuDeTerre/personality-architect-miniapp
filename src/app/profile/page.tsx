'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { useMiniApp } from '@neynar/react';
import { BADGES } from '@/lib/badges';
import { calculateXP, calculateLevel, getLevelProgress, xpForNextLevel, getLevelName, getLevelColor, type UserStats } from '@/lib/gamification';
import ShareCastComposer, { type CastTemplate } from '@/components/share/ShareCastComposer';
import Achievements from '@/components/Achievements';
import MiniAppPage from '@/components/MiniAppPage';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getRandomVariant, levelUpTexts } from '@/lib/castTextVariants';

// Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type MintStatus = 'none' | 'pending' | 'success' | 'failed';

type Profile = {
    fid: number | null;
    supaUserId: string | null;
    wallet: string | null;
    plan: 'free' | 'pro' | 'premium';
    plan_until: string | null;
};

type NeynarProfile = {
    fid: number | null;
    username: string | null;
    displayName: string | null;
    pfpUrl: string | null;
    bio: string | null;
    followerCount: number | null;
    followingCount: number | null;
    updatedAt: string | null;
};

type FarcasterProfileRow = {
    user_id: string;
    fid: number | null;
    username: string | null;
    display_name: string | null;
    pfp_url: string | null;
    bio: string | null;
    follower_count: number | null;
    following_count: number | null;
    updated_at: string | null;
};

type FrameContextUser = {
    fid?: number | null;
    custodyAddress?: string | null;
    walletAddress?: string | null;
};


export default function ProfilePage() {
    const { isSDKLoaded, context, actions } = useMiniApp();

    // Profile
    const [p, setP] = useState<Profile>({
        fid: null,
        supaUserId: null,
        wallet: null,
        plan: 'free',
        plan_until: null,
    });
    const [neynarProfile, setNeynarProfile] = useState<NeynarProfile | null>(null);
    const [neynarLoading, setNeynarLoading] = useState(false);
    const [_neynarError, setNeynarError] = useState<string | null>(null);

    // Mints
    const [statusMap, setStatusMap] = useState<Record<string, MintStatus>>({});
    const [eligMap, setEligMap] = useState<Record<string, { eligible: boolean; reason: string }>>({});
    const [busyCode, setBusyCode] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [badgesLoading, setBadgesLoading] = useState(true);
    const [gamificationStats, setGamificationStats] = useState<UserStats | null>(null);
    const [currentPlan, setCurrentPlan] = useState<'free' | 'pro' | 'premium'>('free');
    const [credits, setCredits] = useState<{ balance: number; nextExpiry: string | null }>({ balance: 0, nextExpiry: null });
    const [aiUsage, setAiUsage] = useState<{ used: number; limit: number; remaining: number }>({ used: 0, limit: 5, remaining: 5 });
    const [featureLimits, setFeatureLimits] = useState<{
        habits: { current: number; limit: number; unlimited: boolean };
        goals: { current: number; limit: number; unlimited: boolean };
    } | null>(null);
    const [unlocks, setUnlocks] = useState<{ habits: boolean; goals: boolean } | null>(null);
    const [mainFocus, setMainFocus] = useState<string | null>(null);
    const [mainFocusEditing, setMainFocusEditing] = useState(false);
    const [mainFocusInput, setMainFocusInput] = useState('');
    const [exporting, setExporting] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    // Headers with Bearer
    const authHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'content-type': 'application/json',
            authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
        };
    }, []);

    // Already minted badge statuses
    const refreshMints = useCallback(async () => {
        const r = await fetch('/api/mints/status', { headers: await authHeaders() });
        if (!r.ok) return;
        const rows: Array<{ badge_code: string; status: MintStatus }> = await r.json();
        const map: Record<string, MintStatus> = {};
        rows.forEach(x => { map[x.badge_code] = x.status; });
        setStatusMap(map);
    }, [authHeaders]);

    // Eligibility per badge
    const refreshEligibility = useCallback(async () => {
        const entries = await Promise.all(
            BADGES.map(async b => {
                const r = await fetch(`/api/mints/eligibility?code=${b.slug}`, { headers: await authHeaders() });
                if (!r.ok) return [b.slug, { eligible: false, reason: 'error' }] as const;
                const j = await r.json();
                return [b.slug, { eligible: !!j.eligible, reason: String(j.reason || '') }] as const;
            })
        );
        setEligMap(Object.fromEntries(entries));
    }, [authHeaders]);

    // Export data handler - использует SDK openUrl для работы в miniapp
    const handleExport = useCallback((format: 'csv' | 'markdown' | 'json') => {
        return async (e?: React.MouseEvent) => {
            e?.preventDefault();
            e?.stopPropagation();

            console.log('[Export] Starting export for format:', format);
            try {
                setExporting(format);

                // Проверяем сессию
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    throw new Error('Необходима авторизация для экспорта данных');
                }

                const sessionHeaders = await authHeaders();
                console.log('[Export] Generating download link...');

                // Генерируем временную ссылку для скачивания
                const response = await fetch('/api/export/download-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        authorization: sessionHeaders.authorization,
                    },
                    body: JSON.stringify({ format }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'unknown', message: 'Failed to generate download link' }));
                    console.error('[Export] API error:', response.status, errorData);
                    
                    if (response.status === 403 && errorData.error === 'unlock_required') {
                        throw new Error('Data export is available only for users with unlocked features. Purchase Unlimited Habits or Unlimited Goals to access data export.');
                    }
                    
                    throw new Error(errorData.message || `Failed to generate download link: ${response.status}`);
                }

                const { url: downloadUrl } = await response.json();
                console.log('[Export] Download URL:', downloadUrl);

                // Используем SDK openUrl для открытия ссылки в браузере
                if (actions?.openUrl) {
                    console.log('[Export] Using SDK openUrl');
                    await actions.openUrl(downloadUrl);
                } else {
                    // Fallback для не-miniapp окружения
                    console.log('[Export] SDK not available, using window.open');
                    window.open(downloadUrl, '_blank');
                }

            } catch (error) {
                console.error('[Export] Error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                alert(`Ошибка при экспорте: ${errorMessage}`);
            } finally {
                setExporting(null);
            }
        };
    }, [authHeaders, actions]);

    // Копирование данных в буфер обмена (для miniapp/iframe)
    const handleCopyToClipboard = useCallback((format: 'markdown' | 'json') => {
        return async () => {
            console.log('[Copy] Starting copy for format:', format);
            try {
                setExporting(format);

                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    throw new Error('Необходима авторизация');
                }

                const sessionHeaders = await authHeaders();
                // Маппинг форматов для обратной совместимости
                const apiFormat = format === 'markdown' ? 'markdown' : format;
                const response = await fetch(`/api/export/data?format=${apiFormat}`, {
                    method: 'GET',
                    headers: { authorization: sessionHeaders.authorization },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'unknown', message: 'Failed to export data' }));
                    console.error('[Copy] API error:', response.status, errorData);
                    
                    if (response.status === 403 && errorData.error === 'unlock_required') {
                        throw new Error('Data export is available only for users with unlocked features. Purchase Unlimited Habits or Unlimited Goals to access data export.');
                    }
                    
                    throw new Error(errorData.message || `Failed: ${response.status}`);
                }

                const text = await response.text();
                console.log('[Copy] Text received, length:', text.length);

                // Копируем в буфер обмена
                await navigator.clipboard.writeText(text);
                console.log('[Copy] Copied to clipboard');

                setCopySuccess(format);
                setTimeout(() => setCopySuccess(null), 3000);

            } catch (error) {
                console.error('[Copy] Error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                alert(`Ошибка: ${errorMessage}`);
            } finally {
                setExporting(null);
            }
        };
    }, [authHeaders]);

    const loadNeynarProfile = useCallback(async (fid: number | null, userId: string | null) => {
        if (!fid && !userId) {
            setNeynarProfile(null);
            setNeynarError(null);
            return;
        }
        setNeynarLoading(true);
        setNeynarError(null);
        try {
            let response: { data: FarcasterProfileRow | null; error: PostgrestError | null } = { data: null, error: null };

            const baseSelect = 'user_id, fid, username, display_name, pfp_url, bio, follower_count, following_count, updated_at';

            if (userId) {
                response = await supabase
                    .from('farcaster_profiles')
                    .select(baseSelect)
                    .eq('user_id', userId)
                    .maybeSingle<FarcasterProfileRow>();
            } else if (fid) {
                response = await supabase
                    .from('farcaster_profiles')
                    .select(baseSelect)
                    .eq('fid', fid)
                    .maybeSingle<FarcasterProfileRow>();
            }

            const { data, error } = response;
            if (error) throw error;
            if (!data && fid) {
                try {
                    const headers = await authHeaders();
                    const fallbackRes = await fetch('/api/neynar/users', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ fids: [fid] }),
                    });
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        const fallbackProfile = Array.isArray(fallbackData.users) ? fallbackData.users[0] : null;
                        if (fallbackProfile) {
                            setNeynarProfile({
                                fid: fallbackProfile.fid ?? fid,
                                username: fallbackProfile.username ?? null,
                                displayName: fallbackProfile.displayName ?? null,
                                pfpUrl: fallbackProfile.pfpUrl ?? null,
                                bio: fallbackProfile.bio ?? null,
                                followerCount: fallbackProfile.followerCount ?? null,
                                followingCount: fallbackProfile.followingCount ?? null,
                                updatedAt: new Date().toISOString(),
                            });
                            return;
                        }
                    }
                } catch (fallbackErr) {
                    console.error('[Profile] Fallback fetch failed:', fallbackErr);
                }
                setNeynarProfile(null);
                return;
            }
            if (data) {
                setNeynarProfile({
                    fid: data.fid ?? null,
                    username: data.username ?? null,
                    displayName: data.display_name ?? null,
                    pfpUrl: data.pfp_url ?? null,
                    bio: data.bio ?? null,
                    followerCount: data.follower_count ?? null,
                    followingCount: data.following_count ?? null,
                    updatedAt: data.updated_at ?? null,
                });
            }
        } catch (err: unknown) {
            console.error('[Neynar] Failed to load profile', err);
            const message = err instanceof Error ? err.message : 'Failed to load profile';
            setNeynarProfile(null);
            setNeynarError(message);
        } finally {
            setNeynarLoading(false);
        }
    }, [authHeaders]);

    // Init: miniapp context, soft Supabase login, load mint status/eligibility
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Ждем загрузки Neynar SDK
                if (!isSDKLoaded) {
                    return;
                }

                let fid = context?.user?.fid ? Number(context.user.fid) : null;
                let wallet = (context?.user as any)?.custodyAddress ?? (context?.user as any)?.walletAddress ?? null;

                // Supabase session
                let { data } = await supabase.auth.getUser();
                if (!data.user && fid) {
                    // Передаем wallet при логине, чтобы сохранить его в базу
                    const res = await fetch('/api/auth/farcaster-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fid, wallet }),
                    });
                    const { access_token } = await res.json().catch(() => ({}));
                    if (access_token) {
                        await supabase.auth.setSession({ access_token, refresh_token: '' });
                        ({ data } = await supabase.auth.getUser());
                    }
                }

                // Загружаем fid и wallet из базы данных
                if (data.user?.id) {
                    const { data: profileRow, error: profileError } = await supabase
                        .from('users')
                        .select('fid, wallet')
                        .eq('id', data.user.id)
                        .maybeSingle<{ fid: number | null; wallet: string | null }>();
                    
                    if (profileError) {
                        console.error('[Profile] Error loading user profile:', profileError);
                    }
                    
                    if (profileRow) {
                        if (!fid && profileRow.fid) {
                            fid = profileRow.fid;
                        }
                        
                        // ВАЖНО: Приоритет у wallet из базы данных
                        // Если в базе есть wallet - используем его
                        if (profileRow.wallet) {
                            wallet = profileRow.wallet;
                            console.log('[Profile] Using wallet from database:', wallet?.slice(0, 10) + '...');
                        } else if (wallet) {
                            // Если в базе нет, но есть в контексте - сохраняем в БД
                            console.log('[Profile] Saving wallet from context to database:', wallet?.slice(0, 10) + '...');
                            try {
                                const headers = await authHeaders();
                                const saveRes = await fetch('/api/profile/wallet', {
                                    method: 'POST',
                                    headers,
                                    body: JSON.stringify({ wallet }),
                                });
                                if (saveRes.ok) {
                                    console.log('[Profile] Wallet saved successfully');
                                } else {
                                    const errorData = await saveRes.json().catch(() => ({}));
                                    console.error('[Profile] Failed to save wallet:', errorData);
                                }
                            } catch (error) {
                                console.error('[Profile] Failed to save wallet:', error);
                            }
                        } else {
                            console.log('[Profile] No wallet found in database or context');
                        }
                    } else {
                        console.warn('[Profile] User profile not found in database');
                    }
                }

                if (cancelled) return;

                setP({
                    fid,
                    supaUserId: data.user?.id ?? null,
                    wallet,
                    plan: 'free',
                    plan_until: null,
                });

                await Promise.allSettled([refreshMints(), refreshEligibility()]);

                if (!cancelled) {
                    setBadgesLoading(false);
                }

                await loadNeynarProfile(fid, data.user?.id ?? null);

                if (cancelled) return;

                // Load gamification stats
                const statsRes = await fetch('/api/stats/gamification', { headers: await authHeaders() });
                if (statsRes.ok) {
                    const stats = await statsRes.json();
                    setGamificationStats(stats);
                }

                // Load current plan
                const planRes = await fetch('/api/plan', { headers: await authHeaders() });
                if (planRes.ok) {
                    const planData = await planRes.json();
                    setCurrentPlan(planData.plan || 'free');
                }

                // Load limits and credits
                const limitsRes = await fetch('/api/limits', { headers: await authHeaders() });
                if (limitsRes.ok) {
                    const limitsData = await limitsRes.json();
                    setCredits(limitsData.credits || { balance: 0, nextExpiry: null });
                    setAiUsage(limitsData.ai || { used: 0, limit: 5, remaining: 5 });
                    setFeatureLimits({
                        habits: limitsData.habits,
                        goals: limitsData.goals,
                    });
                    setUnlocks(limitsData.unlocks || { habits: false, goals: false });
                }

                // Load main focus
                const focusRes = await fetch('/api/profile/main-focus', { headers: await authHeaders() });
                if (focusRes.ok) {
                    const focusData = await focusRes.json();
                    setMainFocus(focusData.main_focus || null);
                    setMainFocusInput(focusData.main_focus || '');
                }
            } catch (error) {
                console.error('[Profile] init error:', error);
                if (!cancelled) {
                    setBadgesLoading(false);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [refreshMints, refreshEligibility, loadNeynarProfile, authHeaders, isSDKLoaded, context]);

    const handleSaveMainFocus = async () => {
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/profile/main-focus', {
                method: 'PUT',
                headers,
                body: JSON.stringify({ main_focus: mainFocusInput.trim() || null }),
            });

            if (res.ok) {
                const data = await res.json();
                setMainFocus(data.main_focus);
                setMainFocusEditing(false);
            } else {
                const { toast } = await import('sonner');
                toast.error('Failed to save main focus');
            }
        } catch (error) {
            console.error('Failed to save main focus:', error);
            const { toast } = await import('sonner');
            toast.error('Failed to save main focus');
        }
    };

    // Refresh wallet from database and context
    const refreshWallet = useCallback(async () => {
        try {
            console.log('[Profile] Refreshing wallet...');
            
            // Сначала проверяем контекст Farcaster
            let walletFromContext = (context?.user as any)?.custodyAddress ?? (context?.user as any)?.walletAddress ?? null;
            console.log('[Profile] Wallet from context:', walletFromContext ? walletFromContext.slice(0, 10) + '...' : 'null');
            
            const { data } = await supabase.auth.getUser();
            if (!data.user?.id) {
                console.log('[Profile] No user ID, using wallet from context only');
                // Если нет пользователя, но есть кошелек в контексте, используем его
                if (walletFromContext) {
                    setP(prev => ({
                        ...prev,
                        wallet: walletFromContext,
                    }));
                }
                return;
            }

            const { data: profileRow, error: profileError } = await supabase
                .from('users')
                .select('wallet')
                .eq('id', data.user.id)
                .maybeSingle<{ wallet: string | null }>();

            if (profileError) {
                console.error('[Profile] Error loading wallet from database:', profileError);
            }

            console.log('[Profile] Wallet from database:', profileRow?.wallet ? profileRow.wallet.slice(0, 10) + '...' : 'null');

            // ВАЖНО: Приоритет у wallet из базы данных
            const finalWallet = profileRow?.wallet || walletFromContext || null;

            console.log('[Profile] Final wallet to use:', finalWallet ? finalWallet.slice(0, 10) + '...' : 'null');

            if (finalWallet) {
                setP(prev => {
                    const newWallet = finalWallet;
                    console.log('[Profile] Updating wallet state:', newWallet.slice(0, 10) + '...');
                    return {
                        ...prev,
                        wallet: newWallet,
                    };
                });

                // Если кошелек есть в контексте, но не в базе - сохраняем его
                if (walletFromContext && !profileRow?.wallet) {
                    console.log('[Profile] Saving wallet from context to database...');
                    try {
                        const headers = await authHeaders();
                        const saveRes = await fetch('/api/profile/wallet', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ wallet: walletFromContext }),
                        });
                        if (saveRes.ok) {
                            console.log('[Profile] Wallet saved successfully to database');
                        } else {
                            const errorData = await saveRes.json().catch(() => ({}));
                            console.error('[Profile] Failed to save wallet:', errorData);
                        }
                    } catch (error) {
                        console.error('[Profile] Failed to save wallet from context:', error);
                    }
                }
            } else {
                console.log('[Profile] No wallet found anywhere');
                setP(prev => ({
                    ...prev,
                    wallet: null,
                }));
            }
        } catch (error) {
            console.error('[Profile] Failed to refresh wallet:', error);
        }
    }, [context, authHeaders]);

    useEffect(() => {
        if (!p.fid && !p.supaUserId) return;
        loadNeynarProfile(p.fid, p.supaUserId);
    }, [p.fid, p.supaUserId, loadNeynarProfile]);

    // Listen for wallet updates from WalletSelectionModal
    useEffect(() => {
        const handleWalletUpdate = () => {
            refreshWallet();
        };

        // Listen for custom event
        window.addEventListener('wallet-updated', handleWalletUpdate);
        
        // Also listen for storage changes (when wallet is saved to localStorage)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'selected_wallet') {
                refreshWallet();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('wallet-updated', handleWalletUpdate);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [refreshWallet]);

    // Mint button
    async function mint(slug: string) {
        setBusyCode(slug);
        try {
            const r = await fetch('/api/mints/mint', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ code: slug, to: p.wallet }),
            });
            const j = await r.json();
            if (!r.ok) {
                alert(`Mint blocked: ${j?.reason || j?.error || 'error'}`);
                return;
            }
            await refreshMints();
        } finally {
            setBusyCode(null);
        }
    }


    // Calculate XP and level - используем totalXP из таблицы xp_events, если доступен
    const xp = gamificationStats?.totalXP ?? (gamificationStats ? calculateXP(gamificationStats) : 0);
    const level = calculateLevel(xp);
    const progress = getLevelProgress(xp, level);
    const xpGap = xpForNextLevel(level);
    const xpForCurrentLevel = (level ** 2) * 100;
    const xpInCurrentLevel = Math.max(xp - xpForCurrentLevel, 0);
    const xpRemaining = Math.max(xpGap - xpInCurrentLevel, 0);
    const levelName = getLevelName(level);
    const levelColor = getLevelColor(level);
    const levelAccentHex = useMemo(() => {
        if (level < 2) return '#94A3B8';
        if (level < 4) return '#60A5FA';
        if (level < 6) return '#A78BFA';
        if (level < 8) return '#F472B6';
        return '#FACC15';
    }, [level]);
    const progressPercent = Math.round(progress);

    const neynarDisplayName =
        neynarProfile?.displayName ??
        neynarProfile?.username ??
        (neynarProfile?.fid ? `FID ${neynarProfile.fid}` : null);

    const neynarInitials = neynarProfile && neynarDisplayName
        ? (neynarDisplayName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'FC')
        : 'FC';

    const levelShareTemplates = useMemo<CastTemplate[]>(() => {
        const templates: CastTemplate[] = [];
        if (gamificationStats) {
            templates.push({
                key: 'level',
                label: `Level ${level} ${levelName}`,
                title: 'Level Up',
                kind: 'level',
                text: getRandomVariant(levelUpTexts(levelName, level, xp)),
                previewParams: {
                    variant: 'level:up',
                    level: String(level),
                    xp: String(xp),
                    gap: String(Math.max(xpRemaining, 0)),
                    name: levelName,
                    color: levelAccentHex,
                    badge: `${levelName} tier`,
                    percent: String(progressPercent),
                },
                targetPath: '/profile',
            });
        }
        return templates;
    }, [gamificationStats, level, levelName, xp, xpRemaining, levelAccentHex, progressPercent]);

    // Parse bio into attributes/tags
    const bioAttributes = useMemo(() => {
        if (!neynarProfile?.bio) return [];
        // Split bio by "|" and extract emoji + text
        return neynarProfile.bio
            .split('|')
            .map(attr => attr.trim())
            .filter(Boolean)
            .map(attr => {
                const emojiMatch = attr.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                const emoji = emojiMatch ? emojiMatch[0] : '';
                const text = attr.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/u, '').trim();
                return { emoji, text };
            });
    }, [neynarProfile?.bio]);

    return (
        <MiniAppPage>
            <div>
                {/* Profile Section */}
                <section className="space-y-1 mb-2">
                    {neynarLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-full bg-white/10"></div>
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-5 bg-white/10 rounded w-28"></div>
                                    <div className="h-4 bg-white/10 rounded w-20"></div>
                                </div>
                            </div>
                        </div>
                    ) : neynarProfile ? (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2">
                            <div className="flex items-start gap-4">
                                {/* Profile Picture */}
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-2xl font-semibold text-white/80 relative flex-shrink-0">
                                    {neynarProfile.pfpUrl ? (
                                        <Image
                                            src={neynarProfile.pfpUrl}
                                            alt={neynarDisplayName ?? 'Farcaster user'}
                                            className="object-cover"
                                            fill
                                            sizes="64px"
                                            unoptimized
                                        />
                                    ) : (
                                        neynarInitials
                                    )}
                                </div>

                                {/* User Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xl font-bold text-white mb-1">
                                        {neynarProfile.displayName ?? neynarProfile.username ?? 'Farcaster User'}
                                    </div>
                                    {neynarProfile.username && (
                                        <div className="text-sm text-white/60 mb-1">@{neynarProfile.username}</div>
                                    )}
                                    {neynarProfile.fid && (
                                        <div className="text-sm text-white/60 mb-3">FID {neynarProfile.fid}</div>
                                    )}

                                    {/* Bio Attributes */}
                                    {bioAttributes.length > 0 && (
                                        <div className="text-sm text-white/70 flex flex-wrap items-center gap-1">
                                            {bioAttributes.map((attr, idx) => (
                                                <span key={idx} className="flex items-center gap-1">
                                                    {attr.emoji && <span>{attr.emoji}</span>}
                                                    <span>{attr.text}</span>
                                                    {idx < bioAttributes.length - 1 && <span className="text-white/40 mx-1">|</span>}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl text-white/60">
                                    🧑‍🚀
                                </div>
                                <div className="flex-1">
                                    <div className="text-xl font-bold text-white mb-1">Farcaster user</div>
                                    <div className="text-sm text-white/60 mb-2">Connect your Farcaster profile to unlock personalized insights.</div>
                                    <p className="text-xs text-white/50">
                                        Open the app from Farcaster to automatically link your profile.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Main Focus Section */}
                <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-2 sm:p-3 mb-3">
                    <h2 className="text-base font-semibold text-white mb-2">Main Life Focus</h2>
                    <p className="text-xs text-white/60 mb-2">
                        Your North Star - what you're focusing on for the next 3 months. This helps AI give you more personalized advice.
                    </p>
                    {mainFocusEditing ? (
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={mainFocusInput}
                                onChange={(e) => setMainFocusInput(e.target.value)}
                                placeholder="e.g., Career, Health, Family, Finance, or custom..."
                                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#8B5CF6]"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveMainFocus();
                                    } else if (e.key === 'Escape') {
                                        setMainFocusEditing(false);
                                        setMainFocusInput(mainFocus || '');
                                    }
                                }}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveMainFocus}
                                    className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm font-semibold"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setMainFocusEditing(false);
                                        setMainFocusInput(mainFocus || '');
                                    }}
                                    className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {mainFocus ? (
                                <div className="flex items-center justify-between">
                                    <p className="text-white/90 font-medium">{mainFocus}</p>
                                    <button
                                        onClick={() => setMainFocusEditing(true)}
                                        className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Edit
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setMainFocusEditing(true)}
                                    className="w-full px-4 py-3 rounded-lg border border-dashed border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors text-sm"
                                >
                                    + Set your main focus
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* Credits & Usage Section */}
                <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-2 sm:p-3 mb-3">
                    {/* AI Credits Row */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-xl">
                                💎
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-white/60">AI CREDITS</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-white">{credits.balance}</span>
                                    <span className="text-sm text-white/60">bonus</span>
                                </div>
                            </div>
                        </div>
                        <a
                            href="/pricing"
                            className="rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 shadow-lg shadow-[#8B5CF6]/30"
                        >
                            + Buy
                        </a>
                    </div>

                    {/* Daily Usage */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white/60">Daily AI Usage</span>
                            <span className="text-xs text-white/80">{aiUsage.used}/{aiUsage.limit}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${
                                    aiUsage.remaining <= 1 ? 'bg-red-500' : 
                                    aiUsage.remaining <= 2 ? 'bg-yellow-500' : 'bg-purple-500'
                                }`}
                                style={{ width: `${(aiUsage.used / aiUsage.limit) * 100}%` }}
                            />
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                            {aiUsage.remaining > 0 
                                ? `${aiUsage.remaining} free requests left today`
                                : 'Use bonus credits for more AI requests'}
                        </p>
                    </div>

                    {/* Feature Limits */}
                    {featureLimits && (
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                            <div className="text-center">
                                <p className="text-xs text-white/60 mb-1">Habits</p>
                                {featureLimits.habits.unlimited ? (
                                    <p className="text-sm font-semibold text-green-400">♾️ Unlimited</p>
                                ) : (
                                    <p className="text-sm font-semibold text-white">
                                        {featureLimits.habits.current}/{featureLimits.habits.limit}
                                    </p>
                                )}
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-white/60 mb-1">Goals</p>
                                {featureLimits.goals.unlimited ? (
                                    <p className="text-sm font-semibold text-green-400">♾️ Unlimited</p>
                                ) : (
                                    <p className="text-sm font-semibold text-white">
                                        {featureLimits.goals.current}/{featureLimits.goals.limit}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Unlock promo */}
                    {featureLimits && (!featureLimits.habits.unlimited || !featureLimits.goals.unlimited) && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <a
                                href="/pricing"
                                className="block text-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
                            >
                                🔓 Unlock unlimited habits & goals →
                            </a>
                        </div>
                    )}
                </section>

                {/* Your Level Section */}
                {gamificationStats && (
                    <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-2 sm:p-3 mb-3">
                        <h2 className="text-lg font-semibold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-2">Your Level</h2>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <div className={`text-2xl font-bold ${levelColor}`}>{levelName}</div>
                                <div className="text-sm text-white/70">Level {level}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-white">{xp.toLocaleString()}</div>
                                <div className="text-sm text-white/70">Total XP</div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-white/80">
                                <span>Progress to Level {level + 1}</span>
                                <span>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-white/70">
                                <span>
                                    {xpRemaining > 0
                                        ? `${xpRemaining.toLocaleString()} XP remaining`
                                        : `Ready for level ${level + 1}!`}
                                </span>
                                <span>{((level + 1) ** 2 * 100).toLocaleString()} XP total</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* Share your level */}
                {levelShareTemplates.length > 0 && (
                    <div className="mb-3">
                        <CollapsibleCard title="Share your level" defaultOpen={false}>
                            <ShareCastComposer
                                templates={levelShareTemplates}
                                prepareHeaders={authHeaders}
                            />
                        </CollapsibleCard>
                    </div>
                )}

                {/* Achievements Section */}
                <section className="mb-3">
                    <Achievements
                        badgePanel={{
                            loading: badgesLoading,
                            statusMap,
                            eligibility: eligMap,
                            busyCode,
                            wallet: p.wallet,
                            onMint: mint,
                            onRefreshWallet: refreshWallet,
                        }}
                    />
                </section>

                {/* Export Data */}
                <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-2 sm:p-3 mb-3">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-white/60 mb-1">EXPORT DATA</p>
                            <p className="text-xl font-bold text-white">Download your data</p>
                            <p className="text-sm text-white/60 mt-1">
                                Copy to clipboard or download your data
                            </p>
                        </div>
                    </div>

                    {/* Проверка unlock */}
                    {unlocks && !unlocks.habits && !unlocks.goals ? (
                        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 mb-3">
                            <p className="text-sm text-white/90 mb-2">
                                🔒 Data export is available only for users with unlocked features
                            </p>
                            <p className="text-xs text-white/60 mb-3">
                                Purchase Unlimited Habits or Unlimited Goals to access data export (CSV, JSON, Markdown)
                            </p>
                            <a
                                href="/pricing"
                                className="inline-block rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 shadow-lg shadow-[#8B5CF6]/30"
                            >
                                Unlock Features →
                            </a>
                        </div>
                    ) : (
                        <>
                            {/* Copy success message */}
                            {copySuccess && (
                                <div className="mb-3 p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm text-center">
                                    ✅ Copied to clipboard! Paste in Notion, Obsidian, ChatGPT, or any Markdown editor.
                                </div>
                            )}

                            <div className="space-y-3">
                        {/* JSON - Full Data */}
                        <div className="space-y-1">
                            <p className="text-xs text-white/50 uppercase tracking-wide">Full Data (JSON)</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCopyToClipboard('json')}
                                    disabled={!!exporting}
                                    className="flex-1 rounded-xl border border-white/10 bg-[#1a1b2e] px-3 py-2.5 text-sm text-white font-medium transition hover:bg-white/5 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {exporting === 'json' ? (
                                        <><span className="animate-spin">⏳</span> Loading...</>
                                    ) : copySuccess === 'json' ? (
                                        <><span>✅</span> Copied!</>
                                    ) : (
                                        <><span>📋</span> Copy JSON</>
                                    )}
                                </button>
                                <button
                                    onClick={handleExport('json')}
                                    disabled={!!exporting}
                                    className="rounded-xl border border-white/10 bg-[#1a1b2e] px-3 py-2.5 text-sm text-white/70 font-medium transition hover:bg-white/5 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Download file"
                                >
                                    💾
                                </button>
                            </div>
                        </div>

                        {/* Markdown - универсальный формат */}
                        <div className="space-y-1">
                            <p className="text-xs text-white/50 uppercase tracking-wide">Full Data (md)</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCopyToClipboard('markdown')}
                                    disabled={!!exporting}
                                    className="flex-1 rounded-xl border border-white/10 bg-[#1a1b2e] px-3 py-2.5 text-sm text-white font-medium transition hover:bg-white/5 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {exporting === 'markdown' ? (
                                        <><span className="animate-spin">⏳</span> Loading...</>
                                    ) : copySuccess === 'markdown' ? (
                                        <><span>✅</span> Copied!</>
                                    ) : (
                                        <><span>📋</span> Copy Markdown</>
                                    )}
                                </button>
                                <button
                                    onClick={handleExport('markdown')}
                                    disabled={!!exporting}
                                    className="rounded-xl border border-white/10 bg-[#1a1b2e] px-3 py-2.5 text-sm text-white/70 font-medium transition hover:bg-white/5 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Download file"
                                >
                                    💾
                                </button>
                            </div>
                        </div>

                        {/* CSV */}
                        <div className="space-y-1">
                            <p className="text-xs text-white/50 uppercase tracking-wide">CSV (All Data)</p>
                            <button
                                onClick={handleExport('csv')}
                                disabled={!!exporting}
                                className="w-full rounded-xl border border-white/10 bg-[#1a1b2e] px-3 py-2.5 text-sm text-white font-medium transition hover:bg-white/5 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {exporting === 'csv' ? (
                                    <><span className="animate-spin">⏳</span> Exporting...</>
                                ) : (
                                    <><span>📊</span> Download CSV</>
                                )}
                            </button>
                        </div>
                            </div>

                            <p className="text-xs text-white/40 mt-3 text-center">
                                💡 Download buttons open browser for file download. Copy buttons work in miniapp.
                            </p>
                        </>
                    )}
                </section>
            </div>
        </MiniAppPage>
    );
}

// Info card
function _Info({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
    const content =
        typeof value === 'string' || typeof value === 'number'
            ? value
            : value ?? '—';

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-2 sm:p-3">
            <div className="text-xs text-white/80">{label}</div>
            <div className={mono ? 'font-mono break-all' : ''}>{content}</div>
        </div>
    );
}
