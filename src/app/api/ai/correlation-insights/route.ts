// Placeholder route - not currently implemented
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    return NextResponse.json({ insights: [] }, { status: 200 });
}

