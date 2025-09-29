import type { NextRequest } from 'next/server';
import * as X402 from 'x402-next';

export const runtime = 'nodejs';

const factory =
  (X402 as any).facilitatorHandler ||
  (X402 as any).createFacilitator ||
  (X402 as any).facilitator;

if (!factory) {
  throw new Error('x402-next: facilitator export not found');
}

const handler = factory({
  recipient: process.env.X402_RECIPIENT!,
  network: process.env.X402_NETWORK || 'base-sepolia',
});

export async function POST(req: NextRequest) {
  return handler(req);
}
