export const runtime = 'nodejs';
export const maxDuration = 60;
// src/app/api/rewards/distribute/route.ts
// Cron: батч-раздача накопленных наград $PERSONA на кошельки юзеров.
// Каждый transfer уходит с Builder Code (dataSuffix). Защищён CRON_SECRET.
// vercel.json: { "path": "/api/rewards/distribute", "schedule": "30 0 * * *" }
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
    validateDistributorConfig,
    getTreasuryBalance,
    sendPersonaReward,
} from '@/lib/personaDistributor';

const MAX_USERS_PER_RUN = 25; // ждём подтверждения каждой tx → держим батч в пределах maxDuration
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(req: NextRequest) {
    // авторизация cron (тот же паттерн, что в /api/notifications/cron)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-prod';
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const cfg = validateDistributorConfig();
    if (cfg.ok === false) {
        return NextResponse.json({ error: 'DISTRIBUTOR_CONFIG_MISSING', missing: cfg.missing }, { status: 500 });
    }

    const supa = createServiceClient();

    // 1. Накопленные начисления
    const { data: rows, error } = await supa
        .from('persona_rewards')
        .select('id, user_id, persona_amount')
        .eq('status', 'accrued')
        .order('created_at', { ascending: true })
        .limit(5000);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows || rows.length === 0) {
        return NextResponse.json({ message: 'nothing to distribute', sent: 0 });
    }

    // 2. Группируем по юзеру
    const byUser = new Map<string, { ids: number[]; total: bigint }>();
    for (const r of rows) {
        const acc = byUser.get(r.user_id) ?? { ids: [], total: 0n };
        acc.ids.push(r.id);
        acc.total += BigInt(r.persona_amount);
        byUser.set(r.user_id, acc);
    }

    // 3. Кошельки
    const userIds = [...byUser.keys()];
    const { data: users, error: uErr } = await supa
        .from('users')
        .select('id, wallet, wallet_address')
        .in('id', userIds);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    // юзер может хранить адрес в wallet (актуальный) или wallet_address (легаси) — берём первый валидный
    const walletById = new Map<string, string | null>(
        (users || []).map((u: any) => {
            const w = u.wallet && WALLET_RE.test(u.wallet) ? u.wallet
                : u.wallet_address && WALLET_RE.test(u.wallet_address) ? u.wallet_address
                : null;
            return [u.id, w];
        }),
    );

    // 4. Раздача с защитой по балансу казны
    let remaining = await getTreasuryBalance();
    const results: { user_id: string; status: string; amount?: string; tx?: string; reason?: string }[] = [];
    let processed = 0;
    let sentCount = 0;

    for (const userId of userIds) {
        if (processed >= MAX_USERS_PER_RUN) break;
        const { ids, total } = byUser.get(userId)!;
        const wallet = walletById.get(userId);

        if (!wallet || !WALLET_RE.test(wallet)) {
            results.push({ user_id: userId, status: 'skipped', reason: 'no_wallet' });
            continue; // оставляем accrued — раздадим когда привяжет кошелёк
        }
        if (total <= 0n) {
            results.push({ user_id: userId, status: 'skipped', reason: 'zero' });
            continue;
        }
        if (remaining < total) {
            results.push({ user_id: userId, status: 'skipped', reason: 'treasury_empty' });
            continue; // казна не наполнена (напр. до разлока vault) — оставляем accrued
        }

        processed += 1;
        try {
            const { hash, success } = await sendPersonaReward(wallet as `0x${string}`, total);
            if (!success) {
                results.push({ user_id: userId, status: 'reverted', tx: hash });
                continue; // tx отвалилась — оставляем accrued на следующий запуск
            }
            remaining -= total;
            sentCount += 1;

            const { error: upErr } = await supa
                .from('persona_rewards')
                .update({ status: 'sent', tx_hash: hash, sent_at: new Date().toISOString() })
                .in('id', ids);
            if (upErr) {
                console.error('[rewards] tx confirmed but DB update failed', { userId, hash, msg: upErr.message });
                results.push({ user_id: userId, status: 'sent_db_error', tx: hash, reason: upErr.message });
            } else {
                results.push({ user_id: userId, status: 'sent', amount: total.toString(), tx: hash });
            }
        } catch (e: any) {
            results.push({ user_id: userId, status: 'failed', reason: String(e?.message ?? e) });
        }
    }

    return NextResponse.json({
        message: 'distribution run complete',
        candidates: userIds.length,
        processed,
        sent: sentCount,
        treasury_left: remaining.toString(),
        results: results.slice(0, 100),
    });
}
