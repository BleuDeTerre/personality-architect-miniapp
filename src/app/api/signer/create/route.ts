// src/app/api/signer/create/route.ts
// API для создания User Managed Signer через Neynar API
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { neynarClient } from '@/lib/neynar';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const user = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Получаем FID пользователя из базы
        const { data: userData, error: userError } = await supa
            .from('users')
            .select('fid')
            .eq('id', user.id)
            .maybeSingle();

        if (userError || !userData?.fid) {
            return NextResponse.json({ error: 'fid_not_found' }, { status: 400 });
        }

        const fid = Number(userData.fid);

        // Проверяем: может уже есть approved signer у этого пользователя?
        const { data: existingSigner } = await supa
            .from('user_signers')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'approved')
            .maybeSingle();

        if (existingSigner) {
            console.log('[Signer Create] User already has approved signer:', existingSigner.signer_uuid);
            return NextResponse.json({
                signer_uuid: existingSigner.signer_uuid,
                status: existingSigner.status,
                signer_approval_url: existingSigner.signer_approval_url,
                already_exists: true,
            });
        }

        // Создаем новый signer через Neynar API
        if (!neynarClient) {
            return NextResponse.json({ error: 'neynar_not_configured' }, { status: 503 });
        }

        console.log(`[Signer Create] Creating new signer for FID ${fid}`);

        // Используем Neynar SDK для создания signer'а
        // В SDK v3.34.0 может быть метод createSigner или нужно использовать прямой API вызов
        try {
            // Прямой вызов Neynar API для создания signer'а
            // Endpoint: POST /v2/farcaster/signer/
            const response = await fetch('https://api.neynar.com/v2/farcaster/signer/', {
                method: 'POST',
                headers: {
                    'x-api-key': process.env.NEYNAR_API_KEY!,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('[Signer Create] Neynar API error:', response.status, errorData);
                return NextResponse.json(
                    { error: 'failed_to_create_signer', details: errorData },
                    { status: response.status }
                );
            }

            const signerData = await response.json();
            const signerUuid = signerData.signer_uuid || signerData.uuid;
            const publicKey = signerData.public_key;
            const approvalUrl = signerData.signer_approval_url;

            if (!signerUuid) {
                return NextResponse.json({ error: 'invalid_signer_response' }, { status: 500 });
            }

            console.log('[Signer Create] Signer created:', {
                signer_uuid: signerUuid,
                has_approval_url: !!approvalUrl,
            });

            // Сохраняем signer в базу данных
            const { data: savedSigner, error: saveError } = await supa
                .from('user_signers')
                .insert({
                    user_id: user.id,
                    fid: fid,
                    signer_uuid: signerUuid,
                    public_key: publicKey || null,
                    status: approvalUrl ? 'pending_approval' : 'approved',
                    signer_approval_url: approvalUrl || null,
                })
                .select()
                .single();

            if (saveError) {
                console.error('[Signer Create] Failed to save signer to database:', saveError);
                return NextResponse.json({ error: 'failed_to_save_signer' }, { status: 500 });
            }

            return NextResponse.json({
                signer_uuid: signerUuid,
                status: savedSigner.status,
                signer_approval_url: savedSigner.signer_approval_url,
                needs_approval: !!approvalUrl,
            });
        } catch (error: any) {
            console.error('[Signer Create] Exception:', error);
            return NextResponse.json(
                { error: 'internal_error', message: error?.message },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('[Signer Create] Unexpected error:', error);
        return NextResponse.json(
            { error: 'internal_error', message: error?.message },
            { status: 500 }
        );
    }
}
