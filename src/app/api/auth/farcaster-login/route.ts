// src/app/api/auth/farcaster-login/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getUserProfile, isNeynarEnabled } from '@/lib/neynar';

// Admin client (service role). Server env only.
const admin = createServiceClient();

// Optional server-side shared secret.
// Set FAR_LOGIN_SERVER_SECRET in Vercel and send x-server-secret header from trusted backend/Frame.
function checkServerSecret(req: NextRequest) {
    const required = process.env.FAR_LOGIN_SERVER_SECRET;
    if (!required) return true;
    const got = req.headers.get('x-server-secret');
    return !!got && got === required;
}

function parseFid(v: unknown): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) throw new Error('invalid fid');
    return n;
}

export async function POST(req: NextRequest) {
    try {
        if (!checkServerSecret(req)) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const fid = parseFid(body?.fid);

        // 0) попытка получить профиль Neynar (не критично для логина)
        let neynarProfile = null as Awaited<ReturnType<typeof getUserProfile>> | null;
        if (isNeynarEnabled()) {
            neynarProfile = await getUserProfile(fid);
        }

        // 1) lookup by fid
        const { data: existingUser, error: qErr } = await admin
            .from('users')
            .select('id, email')
            .eq('fid', fid)
            .maybeSingle();
        if (qErr) throw qErr;

        let userId = existingUser?.id;
        const email = existingUser?.email ?? `farcaster-${fid}@example.com`;

        const baseMetadata: Record<string, any> = {
            fid,
            neynar_username: neynarProfile?.username ?? null,
            neynar_display_name: neynarProfile?.displayName ?? null,
            neynar_pfp_url: neynarProfile?.pfpUrl ?? null,
            neynar_profile: neynarProfile,
        };

        // 2) create auth user + row in users if absent
        if (!userId) {
            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: baseMetadata,
            });
            if (authError) throw authError;
            userId = authUser.user.id;

            const { error: insErr } = await admin
                .from('users')
                .insert({ id: userId, fid, email })
                .single();
            if (insErr) throw insErr;
        } else {
            // обновляем metadata для существующего пользователя
            const { data: existingAuth } = await admin.auth.admin.getUserById(userId);
            const mergedMetadata = {
                ...(existingAuth?.user?.user_metadata ?? {}),
                ...baseMetadata,
            };
            await admin.auth.admin.updateUserById(userId, {
                user_metadata: mergedMetadata,
            } as any);
        }

        // 2.5) сохранить профиль Neynar в таблице farcaster_profiles (если доступно)
        if (userId && neynarProfile) {
            try {
                await admin
                    .from('farcaster_profiles')
                    .upsert(
                        {
                            user_id: userId,
                            fid,
                            username: neynarProfile.username ?? null,
                            display_name: neynarProfile.displayName ?? null,
                            pfp_url: neynarProfile.pfpUrl ?? null,
                            bio: neynarProfile.bio ?? null,
                            follower_count: neynarProfile.followerCount ?? null,
                            following_count: neynarProfile.followingCount ?? null,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: 'user_id' }
                    );
            } catch (profileErr) {
                console.error('[Neynar] Failed to upsert profile:', profileErr);
            }
        }

        // 3) magic link and optional access_token
        const { data: linkData, error: linkErr } = (admin.auth.admin as any).generateLink
            ? await (admin.auth.admin as any).generateLink({ type: 'magiclink', email })
            : { data: null, error: new Error('generateLink not available') };
        if (linkErr) throw linkErr;

        const accessToken = (linkData as any)?.properties?.access_token || null;

        return NextResponse.json({
            user_id: userId,
            access_token: accessToken,
            magiclink: (linkData as any)?.properties?.action_link ?? null,
            neynar_profile: neynarProfile,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'internal' }, { status: 500 });
    }
}
