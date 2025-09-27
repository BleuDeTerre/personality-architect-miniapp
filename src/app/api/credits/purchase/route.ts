export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postPaidJSON } from "@/lib/x402Client";
import { getUserIdDev } from "@/lib/auth";

// Админ-клиент Supabase
function admin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// Конфиг пакетов Pro
const PACKS = {
    "pro-monthly": {
        price: 4.99,        // USD
        credits: 12,        // штук
        days: 30            // срок действия
    }
};

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const pack = String(body?.pack || "pro-monthly") as keyof typeof PACKS;
    const cfg = PACKS[pack];
    if (!cfg) {
        return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
    }

    const userId = getUserIdDev();

    try {
        // 1. Берём деньги через x402
        await postPaidJSON("/api/paid/credits/" + pack, { userId });

        // 2. Начисляем кредиты
        const expires = new Date(Date.now() + cfg.days * 864e5).toISOString();
        const supa = admin();
        const { error } = await supa.rpc("add_credits", {
            p_user_id: userId,
            p_period: pack,
            p_amount: cfg.credits,
            p_expires_at: expires
        });
        if (error) throw error;

        return NextResponse.json({
            ok: true,
            pack,
            credits: cfg.credits,
            expires
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "purchase failed" }, { status: 500 });
    }
}
