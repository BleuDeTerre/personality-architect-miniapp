// src/app/api/neynar/users/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { getBulkUsers } from '@/lib/neynar';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        await requireUserFromReq(req);

        const body = await req.json().catch(() => ({}));
        const fids = Array.isArray(body.fids)
            ? body.fids.map((f: any) => Number(f)).filter((f: number) => Number.isInteger(f) && f > 0)
            : [];

        if (fids.length === 0) {
            return NextResponse.json({ error: 'fids_required' }, { status: 400 });
        }

        if (fids.length > 100) {
            return NextResponse.json({ error: 'max_100_fids' }, { status: 400 });
        }

        const users = await getBulkUsers(fids);

        return NextResponse.json({
            users: users.map(user => ({
                fid: user.fid,
                username: user.username,
                displayName: user.display_name,
                pfpUrl: user.pfp_url,
                bio: user.profile?.bio?.text,
                followerCount: user.follower_count,
                followingCount: user.following_count,
            })),
        });
    } catch (error: any) {
        console.error('[Neynar Users] Failed to fetch users', error);
        return NextResponse.json({
            error: error?.message ?? 'failed_to_fetch_users',
        }, { status: 500 });
    }
}

