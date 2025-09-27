// GET /api/paid/ping  -> 200 OK, если прошёл middleware
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ ok: true, message: 'paid endpoint OK' });
}
