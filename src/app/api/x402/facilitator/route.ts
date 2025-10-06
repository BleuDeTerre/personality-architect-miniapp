// src/app/api/x402/facilitator/route.ts
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

async function getFactory() {
  const mod: any = await import('x402-next').catch(() => null);
  if (!mod) return null;

  const f =
    mod?.facilitatorHandler ||
    mod?.createFacilitator ||
    mod?.facilitator ||
    mod?.default?.facilitator ||
    mod?.default?.createFacilitator ||
    mod?.default?.facilitatorHandler ||
    (typeof mod?.default === 'function' ? mod.default : null);

  return typeof f === 'function' ? f : null;
}

export async function POST(req: NextRequest) {
  const factory = await getFactory();
  if (!factory) {
    return new Response(JSON.stringify({ error: 'x402 facilitator export not found' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const handler = factory({
    recipient: process.env.X402_RECIPIENT!,
    network: process.env.X402_NETWORK || 'base-sepolia',
  });

  return handler(req as any);
}
