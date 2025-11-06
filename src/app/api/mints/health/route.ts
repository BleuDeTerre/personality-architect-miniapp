export const runtime = 'nodejs';
// src/app/api/mints/health/route.ts
import { NextResponse } from 'next/server';
import { CHAIN_ID, CONTRACT, RPC_URL, validateZoraConfig } from '@/lib/zora';

export async function GET() {
  const cfg = validateZoraConfig();
  if (cfg.ok === false) {
    return NextResponse.json({ ok: false, missing: cfg.missing }, { status: 500 });
  }
  return NextResponse.json({ ok: true, chainId: CHAIN_ID, contract: CONTRACT, rpc: Boolean(RPC_URL) });
}


