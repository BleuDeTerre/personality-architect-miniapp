// src/app/api/paid/ping/route.ts
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function GET() {
    // ВАЖНО: никаких проверок x402 здесь не делаем.
    // Если middleware потребует оплату — он отдаст 402 ДО входа сюда.
    return NextResponse.json({ ok: true, message: 'paid endpoint OK', ts: Date.now() });
}
