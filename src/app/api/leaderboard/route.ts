export const runtime = 'nodejs';
// src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { parsePaginationParams, getPaginationMeta } from '@/lib/pagination';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

type LeaderboardEntry = {
    user_id: string;
    fid: number | null;
    current_streak: number;
    best_streak: number;
    total_logs: number;
    total_xp: number;
};

type NeynarProfile = {
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

export async function GET(req: NextRequest) {
    // Rate limiting для чтения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.READ);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const pagination = parsePaginationParams(searchParams);
        const usePagination = searchParams.has('page') || searchParams.has('limit');

        const { data: users } = await supa.from('users').select('id, fid');

        if (!users || users.length === 0) {
            return NextResponse.json({ entries: [] });
        }

        const leaderboardEntries: LeaderboardEntry[] = await Promise.all(
            users.map(async (user: any) => {
                try {
                    const { data: stats } = await supa.rpc('get_habit_streak', { p_user: user.id });

                    const { count } = await supa
                        .from('habit_logs')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .eq('value', true);

                    const { data: xpData } = await supa
                        .rpc('get_user_total_xp', { p_user_id: user.id })
                        .single();

                    const entry = Array.isArray(stats) ? stats[0] : { current_streak: 0, best_streak: 0, last_completed: null };

                    return {
                        user_id: user.id,
                        fid: user.fid,
                        current_streak: entry.current_streak || 0,
                        best_streak: entry.best_streak || 0,
                        total_logs: count || 0,
                        total_xp: (typeof xpData === 'number' ? xpData : 0) || 0,
                    };
                } catch (err) {
                    // Если ошибка при получении данных для одного пользователя, возвращаем значения по умолчанию
                    console.error(`Error fetching leaderboard data for user ${user.id}:`, err);
                    return {
                        user_id: user.id,
                        fid: user.fid,
                        current_streak: 0,
                        best_streak: 0,
                        total_logs: 0,
                        total_xp: 0,
                    };
                }
            })
        );

        const sorted = leaderboardEntries.sort((a, b) => {
            if (b.total_xp !== a.total_xp) {
                return b.total_xp - a.total_xp;
            }
            if (b.best_streak !== a.best_streak) {
                return b.best_streak - a.best_streak;
            }
            return b.total_logs - a.total_logs;
        });

        // Подсчет общего количества (только если используется пагинация)
        const total = sorted.length;
        
        // Применяем пагинацию или ограничение до 50 (для обратной совместимости)
        let topEntries: LeaderboardEntry[];
        if (usePagination) {
            const offset = (pagination.page - 1) * pagination.limit;
            topEntries = sorted.slice(offset, offset + pagination.limit);
        } else {
            // Обратная совместимость: без пагинации возвращаем топ-50
            topEntries = sorted.slice(0, 50);
        }

        let profilesMap: Record<string, NeynarProfile> = {};
        if (topEntries.length > 0) {
            const { data: profiles, error: profilesErr } = await supa
                .from('farcaster_profiles')
                .select('user_id, fid, username, display_name, pfp_url, bio, follower_count, following_count, updated_at')
                .in('user_id', topEntries.map(entry => entry.user_id));

            if (!profilesErr && profiles) {
                profilesMap = profiles.reduce((acc: Record<string, NeynarProfile>, profile: any) => {
                    acc[profile.user_id] = {
                        user_id: profile.user_id,
                        fid: profile.fid ?? null,
                        username: profile.username ?? null,
                        display_name: profile.display_name ?? null,
                        pfp_url: profile.pfp_url ?? null,
                        bio: profile.bio ?? null,
                        follower_count: profile.follower_count ?? null,
                        following_count: profile.following_count ?? null,
                        updated_at: profile.updated_at ?? null,
                    };
                    return acc;
                }, {});
            }
        }

        const enriched = topEntries.map(entry => ({
            ...entry,
            neynar_profile: profilesMap[entry.user_id] ?? null,
        }));

        // Находим позицию текущего пользователя в полном списке (даже если он не в топ-50)
        const userPosition = sorted.findIndex(e => e.user_id === userId) + 1; // +1 потому что позиция начинается с 1
        const userEntry = sorted.find(e => e.user_id === userId);
        
        // Если пользователь не в топ-50, получаем его профиль отдельно
        let userProfile: NeynarProfile | null = null;
        if (userEntry && userPosition > 50) {
            const { data: userProfileData } = await supa
                .from('farcaster_profiles')
                .select('user_id, fid, username, display_name, pfp_url, bio, follower_count, following_count, updated_at')
                .eq('user_id', userId)
                .maybeSingle();
            
            if (userProfileData) {
                userProfile = {
                    user_id: userProfileData.user_id,
                    fid: userProfileData.fid ?? null,
                    username: userProfileData.username ?? null,
                    display_name: userProfileData.display_name ?? null,
                    pfp_url: userProfileData.pfp_url ?? null,
                    bio: userProfileData.bio ?? null,
                    follower_count: userProfileData.follower_count ?? null,
                    following_count: userProfileData.following_count ?? null,
                    updated_at: userProfileData.updated_at ?? null,
                };
            }
        }

        // Если используется пагинация - возвращаем с метаданными
        if (usePagination) {
            const meta = getPaginationMeta(total, pagination.page, pagination.limit);
            const response = NextResponse.json({
                entries: enriched,
                viewer: userId,
                userPosition: userPosition > 0 ? userPosition : null,
                userEntry: userEntry && userPosition > 50 ? {
                    ...userEntry,
                    neynar_profile: userProfile,
                } : null,
                ...meta,
            });
            // Server-side cache: лидерборд одинаков для всех, кэшируем на 5 минут
            response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
            return response;
        }

        // Обратная совместимость: без пагинации возвращаем топ-50 + позицию пользователя
        // Если пользователь в топ-50, его entry уже есть в enriched, но возвращаем позицию отдельно
        const response = NextResponse.json({ 
            entries: enriched, 
            viewer: userId,
            userPosition: userPosition > 0 ? userPosition : null,
            // userEntry возвращаем только если пользователь НЕ в топ-50
            userEntry: userEntry && userPosition > 50 ? {
                ...userEntry,
                neynar_profile: userProfile,
            } : null,
        });
        
        // Server-side cache: лидерборд одинаков для всех, кэшируем на 5 минут
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        
        return response;
    } catch (e: any) {
        console.error('Leaderboard error:', e);
        return NextResponse.json({ error: 'failed_to_fetch_leaderboard', detail: e?.message }, { status: 500 });
    }
}

