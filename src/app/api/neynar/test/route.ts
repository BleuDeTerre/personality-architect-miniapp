// src/app/api/neynar/test/route.ts
// Тестовый endpoint для проверки работы Neynar API
import { NextResponse } from 'next/server';
import { isNeynarEnabled, getUserProfile } from '@/lib/neynar';

export const runtime = 'nodejs';

export async function GET() {
    try {
        // Проверка доступности Neynar
        if (!isNeynarEnabled()) {
            return NextResponse.json(
                {
                    success: false,
                    neynarEnabled: false,
                    error: 'Neynar not configured',
                    message: 'NEYNAR_API_KEY is not set in environment variables',
                },
                { status: 500 }
            );
        }

        // Тест получения профиля (используем FID 1 - это официальный аккаунт Farcaster)
        const testFid = 1;
        const profile = await getUserProfile(testFid);

        if (!profile) {
            return NextResponse.json(
                {
                    success: false,
                    neynarEnabled: true,
                    error: 'Failed to fetch profile',
                    message: `Could not fetch profile for FID ${testFid}`,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            neynarEnabled: true,
            message: 'Neynar API is working correctly!',
            testProfile: {
                fid: profile.fid,
                username: profile.username,
                displayName: profile.displayName,
                hasPfp: !!profile.pfpUrl,
                hasBio: !!profile.bio,
                followerCount: profile.followerCount,
                followingCount: profile.followingCount,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                neynarEnabled: isNeynarEnabled(),
                error: 'API Error',
                message: error.message || 'Unknown error occurred',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

