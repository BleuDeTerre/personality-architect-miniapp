export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdDev } from "@/lib/auth";
import { PRICES_USD } from "@/lib/pricing";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PRICE_BY_ENDPOINT: Record<string, number> = {
  "insight/habit": PRICES_USD["/api/paid/insight/habit"],
  "insight/weekly": PRICES_USD["/api/paid/insight/weekly"],
  "insight/monthly": PRICES_USD["/api/paid/insight/monthly"] ?? 0,
};

export async function GET(_req: NextRequest) {
  const PERIOD = "pro-monthly";
  const userId = getUserIdDev();
  const db = admin();

  // остаток и срок действия
  const { data: uc, error: ucErr } = await db
    .from("user_credits")
    .select("credits, expires_at")
    .eq("user_id", userId)
    .eq("period", PERIOD)
    .maybeSingle();
  if (ucErr) return NextResponse.json({ error: ucErr.message }, { status: 500 });

  const credits = uc?.credits ?? 0;
  const expiresAt = uc?.expires_at ?? null;

  // сколько денег сэкономлено за все время по использованным кредитам
  const { data: evs, error: evErr } = await db
    .from("paid_events")
    .select("endpoint, meta")
    .eq("user_id", userId)
    .contains("meta", { used_credit: true })
    .limit(1000); // достаточно для UI
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  const savedUsd = Number(
    (evs || []).reduce((sum, e) => sum + (PRICE_BY_ENDPOINT[e.endpoint] || 0), 0).toFixed(2)
  );
  const usedCredits = evs?.length ?? 0;

  return NextResponse.json({
    period: PERIOD,
    credits,
    expiresAt,
    savedUsd,
    usedCredits,
  });
}
