export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdDev } from "@/lib/auth";
import crypto from "crypto";

// Admin Supabase client: uses service key and bypasses RLS for inserts/updates
function admin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}
function sha(x: unknown) {
    return crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
}

// Mock generator. Replace with real logic/LLM call.
async function generateReport(date: string, highAccuracy: boolean) {
    return {
        date,
        totals: { habits_total: 5, completed: highAccuracy ? 4 : 3, rate_pct: highAccuracy ? 80 : 60 },
        items: [
            { habit_id: "1", title: "Meditation", done: true },
            { habit_id: "2", title: "Workout", done: highAccuracy },
            { habit_id: "3", title: "Reading", done: false },
        ],
        summary: `Habit insight for ${date}. highAccuracy=${highAccuracy ? "on" : "off"}.`,
    };
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || new Date().toISOString().slice(0, 10));
    const highAccuracy = !!body?.highAccuracy;
    const userId = getUserIdDev();
    const endpoint = "insight/habit";
    const PERIOD = "pro-monthly";
    const CACHE_DAYS = 7;

    const key = { date, highAccuracy };
    const input_hash = sha(key);
    const cached_until = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

    const db = admin();

    // 0) Try to consume 1 credit
    const { data: ok, error: consumeErr } = await db.rpc("consume_credit", {
        p_user_id: userId,
        p_period: PERIOD,
    });
    if (consumeErr) return NextResponse.json({ error: consumeErr.message }, { status: 500 });
    if (!ok) return NextResponse.json({ error: "no credits", code: "NO_CREDITS" }, { status: 402 });

    // 1) Cache hit
    {
        const { data: hit } = await db
            .from("ai_reports")
            .select("content, cached_until")
            .eq("user_id", userId).eq("endpoint", endpoint)
            .eq("input_hash", input_hash)
            .gt("cached_until", new Date().toISOString())
            .maybeSingle();
        if (hit?.content) {
            // Log usage even when served from cache
            await db.from("paid_events").insert({
                user_id: userId,
                endpoint,
                amount_usd: 0,
                status: "settled",
                meta: { cachedUntil: hit.cached_until, used_credit: true, period: PERIOD },
            });
            return NextResponse.json({ ...(hit.content as object), cachedUntil: hit.cached_until, usedCredit: true });
        }
    }

    // 2) Generate
    const report = await generateReport(date, highAccuracy);

    // 3) Save cache
    await db.from("ai_reports").upsert({
        user_id: userId,
        endpoint,
        input: key,
        input_hash,
        content: report,
        cached_until,
    }, { onConflict: "user_id,endpoint,input_hash" });

    // 4) Payment log with credit marker
    await db.from("paid_events").insert({
        user_id: userId,
        endpoint,
        amount_usd: 0,
        status: "settled",
        meta: { cachedUntil: cached_until, used_credit: true, period: PERIOD },
    });

    // 5) Audit
    const preview = typeof report.summary === "string" ? report.summary.slice(0, 280) : "";
    await db.from("insights_audit").insert({
        user_id: userId,
        endpoint,
        input: key,
        output_preview: preview,
        tokens_prompt: null,
        tokens_completion: null,
        cost_usd: 0
    });

    // 6) Response
    return NextResponse.json({ ...report, cachedUntil: cached_until, usedCredit: true });
}
