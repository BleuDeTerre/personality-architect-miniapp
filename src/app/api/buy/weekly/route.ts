export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { postPaidJSON } from "@/lib/x402Client";
import { getUserIdDev } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

function admin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const week_start = String(body?.week_start || new Date().toISOString().slice(0, 10));
    const highAccuracy = !!body?.highAccuracy;
    const userId = getUserIdDev();

    const { data: credits, error } = await admin().rpc("get_credits", {
        p_user_id: userId,
        p_period: "pro-monthly",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if ((credits ?? 0) > 0) {
        const r = await fetch(new URL("/api/pro/insight/weekly", req.url), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ week_start, highAccuracy }),
        });
        const j = await r.json();
        if (!r.ok) return NextResponse.json(j, { status: r.status });
        return NextResponse.json(j);
    }

    try {
        const resp = await postPaidJSON("/api/paid/insight/weekly", { userId, week_start, highAccuracy });
        return NextResponse.json(resp);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || "buy failed" }, { status: 500 });
    }
}
