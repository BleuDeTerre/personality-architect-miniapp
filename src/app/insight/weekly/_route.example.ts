import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const week_start = url.searchParams.get("week_start") || new Date().toISOString().slice(0, 10);
    const data = {
        week_start,
        totals: { days: 7, habits_total: 10, completed: 6, rate_pct: 60 },
        items: [
            { day: "Mon", completed: 2, total: 3 },
            { day: "Tue", completed: 1, total: 1 },
            { day: "Wed", completed: 1, total: 2 },
            { day: "Thu", completed: 1, total: 2 },
            { day: "Fri", completed: 1, total: 1 },
            { day: "Sat", completed: 0, total: 1 },
            { day: "Sun", completed: 0, total: 0 },
        ],
        summary: `Free weekly mock from ${week_start}.`,
    };
    return NextResponse.json(data);
}
