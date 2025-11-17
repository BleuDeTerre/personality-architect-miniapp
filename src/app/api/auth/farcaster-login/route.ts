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

        // Получаем выбранный кошелек из body (если передан)
        const selectedWallet = body?.wallet || body?.walletAddress || null;
        const walletType = body?.walletType || 'farcaster'; // 'farcaster' или 'external'
        
        // Определяем финальный кошелек:
        // Если передан selectedWallet - используем его (для external wallet)
        // Для Farcaster wallet - будет получен из контекста на клиенте
        const finalWallet = selectedWallet || null;

        const baseMetadata: Record<string, any> = {
            fid,
            neynar_username: neynarProfile?.username ?? null,
            neynar_display_name: neynarProfile?.displayName ?? null,
            neynar_pfp_url: neynarProfile?.pfpUrl ?? null,
            neynar_profile: neynarProfile,
            wallet_type: walletType,
        };

        // 2) create auth user + row in users if absent
        if (!userId) {
            // Создаем нового пользователя в auth.users и в таблице users
            const { data: authUser, error: authError } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: baseMetadata,
            });
            if (authError) {
                console.error('[Farcaster Login] Failed to create auth user:', authError);
                throw authError;
            }
            userId = authUser.user.id;
            console.log('[Farcaster Login] Created new auth user:', userId);

            const { error: insErr } = await admin
                .from('users')
                .insert({ 
                    id: userId, 
                    fid, 
                    email,
                    wallet_address: finalWallet,
                })
                .single();
            if (insErr) {
                console.error('[Farcaster Login] Failed to insert user row:', insErr);
                throw insErr;
            }
        } else {
            // Пользователь есть в таблице users, проверяем есть ли он в auth.users
            console.log('[Farcaster Login] User exists in users table:', userId);
            let authUserExists = false;
            try {
                const { data: existingAuth, error: authCheckError } = await admin.auth.admin.getUserById(userId);
                if (existingAuth?.user && !authCheckError) {
                    authUserExists = true;
                    console.log('[Farcaster Login] User exists in auth.users');
                    // Обновляем metadata для существующего пользователя
                    const mergedMetadata = {
                        ...(existingAuth.user.user_metadata ?? {}),
                        ...baseMetadata,
                    };
                    await admin.auth.admin.updateUserById(userId, {
                        user_metadata: mergedMetadata,
                    } as any);
                } else {
                    console.warn('[Farcaster Login] User not found in auth.users, error:', authCheckError);
                }
            } catch (checkError) {
                console.error('[Farcaster Login] Error checking auth user:', checkError);
            }

            // Если пользователя нет в auth.users, создаем его
            if (!authUserExists) {
                console.log('[Farcaster Login] Creating auth user for existing user in users table, userId:', userId);
                try {
                    // Пробуем создать с существующим ID
                    const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
                        id: userId, // Используем существующий ID
                        email,
                        email_confirm: true,
                        user_metadata: baseMetadata,
                    });
                    if (createError) {
                        console.error('[Farcaster Login] Failed to create auth user with existing ID:', createError);
                        // Если не удалось создать с существующим ID (возможно ID уже занят), пробуем без ID
                        console.log('[Farcaster Login] Trying to create auth user without ID...');
                        const { data: fallbackAuthUser, error: fallbackError } = await admin.auth.admin.createUser({
                            email: `farcaster-${fid}-${Date.now()}@example.com`, // Уникальный email
                            email_confirm: true,
                            user_metadata: baseMetadata,
                        });
                        if (fallbackError) {
                            console.error('[Farcaster Login] Fallback create also failed:', fallbackError);
                            // Не бросаем ошибку - попробуем сгенерировать токен для существующего userId
                            console.warn('[Farcaster Login] Will try to generate token for existing userId:', userId);
                        } else {
                            // Обновляем ID в таблице users на новый auth user ID
                            const newUserId = fallbackAuthUser.user.id;
                            console.log('[Farcaster Login] Created new auth user with fallback ID:', newUserId);
                            const { error: updateError } = await admin.from('users').update({ id: newUserId }).eq('fid', fid);
                            if (updateError) {
                                console.error('[Farcaster Login] Failed to update users table with new ID:', updateError);
                            } else {
                                userId = newUserId;
                                console.log('[Farcaster Login] Updated users table with new auth user ID');
                            }
                        }
                    } else {
                        console.log('[Farcaster Login] Created auth user with existing ID:', userId);
                        // Проверяем, что пользователь действительно создан
                        const { data: verifyAuth, error: verifyErr } = await admin.auth.admin.getUserById(userId);
                        if (verifyErr || !verifyAuth?.user) {
                            console.error('[Farcaster Login] Auth user not found after creation:', verifyErr);
                        } else {
                            console.log('[Farcaster Login] Auth user verified after creation');
                        }
                    }
                } catch (createErr) {
                    console.error('[Farcaster Login] Error creating auth user:', createErr);
                    // Продолжаем - может быть токен все равно можно сгенерировать
                }
            }
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
        let accessToken: string | null = null;
        console.log('[Farcaster Login] Attempting to generate token for user:', userId, 'email:', email);
        
        try {
            // Сначала проверяем, что пользователь существует в auth.users
            let verifyUser: { user: any } | null = null;
            let verifyError: any = null;
            
            const verifyResult = await admin.auth.admin.getUserById(userId);
            verifyUser = verifyResult.data;
            verifyError = verifyResult.error;
            
            if (verifyError || !verifyUser?.user) {
                console.error('[Farcaster Login] User not found in auth.users before token generation:', verifyError);
                // Если пользователя нет, но мы только что его создали, возможно нужно подождать
                console.log('[Farcaster Login] Waiting 500ms and retrying...');
                await new Promise(resolve => setTimeout(resolve, 500));
                const retryResult = await admin.auth.admin.getUserById(userId);
                if (retryResult.error || !retryResult.data?.user) {
                    console.error('[Farcaster Login] User still not found after retry:', retryResult.error);
                    throw new Error(`User ${userId} not found in auth.users after creation attempt`);
                }
                console.log('[Farcaster Login] User found after retry');
                verifyUser = retryResult.data;
            } else {
                console.log('[Farcaster Login] User verified in auth.users, generating token...');
            }

            const userEmail = verifyUser?.user?.email || email;
            console.log('[Farcaster Login] Generating token with email:', userEmail);
            
            const { data: linkData, error: linkErr } = (admin.auth.admin as any).generateLink
                ? await (admin.auth.admin as any).generateLink({ type: 'magiclink', email: userEmail })
                : { data: null, error: new Error('generateLink not available') };
            
            if (linkErr) {
                console.error('[Farcaster Login] generateLink error:', linkErr);
                // Пробуем альтернативный способ - используем email из verifyUser
                try {
                    const altEmail = verifyUser.user.email || email;
                    console.log('[Farcaster Login] Trying alternative token generation with email:', altEmail);
                    const { data: sessionData, error: altErr } = await (admin.auth.admin as any).generateLink({
                        type: 'magiclink',
                        email: altEmail,
                    });
                    if (altErr) {
                        console.error('[Farcaster Login] Alternative token generation also failed:', altErr);
                    } else {
                        accessToken = (sessionData as any)?.properties?.access_token || null;
                        console.log('[Farcaster Login] Alternative token generation:', { hasToken: !!accessToken, tokenLength: accessToken?.length || 0 });
                    }
                } catch (altError) {
                    console.error('[Farcaster Login] Alternative token generation failed:', altError);
                }
            } else {
                accessToken = (linkData as any)?.properties?.access_token || null;
                console.log('[Farcaster Login] Token from generateLink:', { hasToken: !!accessToken, tokenLength: accessToken?.length || 0 });
            }
        } catch (tokenError) {
            console.error('[Farcaster Login] Token generation error:', tokenError);
        }

        if (!accessToken) {
            console.error('[Farcaster Login] No access token generated for user:', userId);
            return NextResponse.json({
                error: 'failed_to_generate_token',
                user_id: userId,
                message: 'Could not generate access token. Please try refreshing the page.',
            }, { status: 500 });
        }

        return NextResponse.json({
            user_id: userId,
            access_token: accessToken,
            refresh_token: null, // generateLink не возвращает refresh_token
            neynar_profile: neynarProfile,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'internal' }, { status: 500 });
    }
}
