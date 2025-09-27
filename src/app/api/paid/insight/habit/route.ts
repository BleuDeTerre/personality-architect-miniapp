// Paid endpoint with 7-day cache, highAccuracy, and timeout fallback
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdDev } from "@/lib/auth";
import crypto from "crypto";

// Admin Supabase client: inserts/updates with service key (bypasses RLS)
function admin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// Utility: sha256(JSON.stringify(obj))
function hashInput(obj: unknown) {
    return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

// Mock report generation. Replace with a real LLM call.
// Returns the report structure.
async function generateReport(date: string, highAccuracy: boolean) {
    // TODO: your aggregations + LLM here. For now — mock.
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

// Timeout wrapper: if generation > t ms, return a simple fallback
async function withTimeout<T>(p: Promise<T>, ms: number, fallback: () => T): Promise<T> {
    let timer: NodeJS.Timeout;
    const to = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback()), ms);
    });
    const res = await Promise.race([p, to]);
    // @ts-expect-error timer is defined
    clearTimeout(timer);
    return res as T;
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || new Date().toISOString().slice(0, 10));
    const highAccuracy = !!body?.highAccuracy;
    const userId = getUserIdDev();
    const endpoint = "insight/habit";
    const CACHE_DAYS = 7;

    const key = { date, highAccuracy };
    const inputHash = hashInput(key);
    const cachedUntil = new Date(Date.now() + CACHE_DAYS * 864e5).toISOString();

    const db = admin();

    // 1) CACHE: look up a valid cached report
    {
        const { data: hit, error } = await db
            .from("ai_reports")
            .select("content, cached_until")
            .eq("user_id", userId)
            .eq("endpoint", endpoint)
            .eq("input_hash", inputHash)
            .gt("cached_until", new Date().toISOString())
            .maybeSingle();

        if (!error && hit?.content) {
            // Return cached content
            return NextResponse.json({ ...(hit.content as object), cachedUntil: hit.cached_until });
        }
    }

    // 2) Generate with timeout fallback (e.g., 12 seconds)
    const report = await withTimeout(
        generateReport(date, highAccuracy),
        12_000,
        () => ({
            date,
            totals: { habits_total: 0, completed: 0, rate_pct: 0 },
            items: [],
            summary: `Fallback: generation exceeded the time budget. Showing a draft report for ${date}.`,
        })
    );

    // 3) Save cache (idempotent by unique key)
    const contentWithCache = { ...report };
    await db.from("ai_reports").upsert(
        {
            user_id: userId,
            endpoint,
            input: key,
            input_hash: inputHash,
            content: contentWithCache,
            cached_until: cachedUntil,
        },
        { onConflict: "user_id,endpoint,input_hash" }
    );

    // 4) Log purchase (for history)
    await db.from("paid_events").insert({
        user_id: userId,
        endpoint,
        amount_usd: 0.15,
        status: "settled",
        meta: { cachedUntil },
    });

    // 5) Audit (short preview)
    const preview =
        typeof report.summary === "string"
            ? report.summary.slice(0, 280)
            : JSON.stringify(report).slice(0, 280);

    await db.from("insights_audit").insert({
        user_id: userId,
        endpoint,
        input: key,
        output_preview: preview,
        tokens_prompt: null,       // fill after LLM integration
        tokens_completion: null,   // fill after LLM integration
        cost_usd: null             // fill after LLM integration
    });

    // 6) Response to client
    return NextResponse.json({ ...report, cachedUntil });
}
