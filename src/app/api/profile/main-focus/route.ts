// src/app/api/profile/main-focus/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

// GET /api/profile/main-focus - Get user's main focus
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

        // Try user_profile_settings first, then user_plans as fallback
        const { data: profileData } = await supa
            .from('user_profile_settings')
            .select('main_focus')
            .eq('user_id', userId)
            .single();

        if (profileData) {
            return NextResponse.json({ main_focus: profileData.main_focus || null });
        }

        // Fallback to user_plans if user_profile_settings doesn't exist or has no data
        const { data: planData } = await supa
            .from('user_plans')
            .select('main_focus')
            .eq('user_id', userId)
            .maybeSingle();

        return NextResponse.json({ main_focus: planData?.main_focus || null });
    } catch (error: any) {
        console.error('[Main Focus GET] Unexpected error:', error);
        return NextResponse.json({ main_focus: null, error: error?.message || 'Unknown error' }, { status: 500 });
    }
}

// PUT /api/profile/main-focus - Update user's main focus
export async function PUT(req: NextRequest) {
    // Rate limiting для изменения данных
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.API);
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
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const body = await req.json().catch(() => ({}));
        const mainFocus = body?.main_focus ? String(body.main_focus).trim() : null;

        // Try to update user_profile_settings first
        const { data: existingProfile } = await supa
            .from('user_profile_settings')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingProfile) {
            // Update existing profile
            const { data, error } = await supa
                .from('user_profile_settings')
                .update({ main_focus: mainFocus })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('[Main Focus PUT] Error updating profile:', error);
                return NextResponse.json({ error: 'Failed to update main focus', details: error.message }, { status: 500 });
            }

            return NextResponse.json({ main_focus: data.main_focus });
        } else {
            // Create new profile entry
            const { data, error } = await supa
                .from('user_profile_settings')
                .insert({ user_id: userId, main_focus: mainFocus })
                .select()
                .single();

            if (error) {
                console.error('[Main Focus PUT] Error creating profile:', error);
                // If user_profile_settings doesn't exist, try user_plans as fallback
                const { data: planData } = await supa
                    .from('user_plans')
                    .select('user_id')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (planData) {
                    const { data: updatedPlan, error: planError } = await supa
                        .from('user_plans')
                        .update({ main_focus: mainFocus })
                        .eq('user_id', userId)
                        .select()
                        .single();

                    if (planError) {
                        return NextResponse.json({ error: 'Failed to update main focus', details: planError.message }, { status: 500 });
                    }

                    return NextResponse.json({ main_focus: updatedPlan.main_focus });
                }

                return NextResponse.json({ error: 'Failed to update main focus', details: error.message }, { status: 500 });
            }

            return NextResponse.json({ main_focus: data.main_focus });
        }
    } catch (error: any) {
        console.error('[Main Focus PUT] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to update main focus', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

