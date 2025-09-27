'use client';

// RU: экран бейджей. Ввод адреса кошелька, кнопка Mint с оплатой x402.
import { useEffect, useMemo, useState } from 'react';
import { BADGES } from '@/lib/badges';
import { PRICES_USD } from '@/lib/pricing';
import PayButton from '@/components/PayButton';

const PAID_PATH = '/api/mint' as const;

function isEthAddress(s: string) { return /^0x[0-9a-fA-F]{40}$/.test(s); }

export default function BadgesPage() {
  const [to, setTo] = useState('');
  const [_mintingSlug, setMintingSlug] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const valid = useMemo(() => isEthAddress(to), [to]);

  async function doMint(slug: string) {
    setMintingSlug(slug);
    setTxHash(null);
    try {
      const r = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge: slug, to }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setTxHash(j.txHash);
    } finally {
      setMintingSlug(null);
    }
  }

  async function onPaid(slug: string) {
    await doMint(slug);
  }

  useEffect(() => {
    let t: any;
    if (txHash) {
      t = setInterval(async () => {
        const r = await fetch(`/api/mint/status?tx=${txHash}`, { cache: 'no-store' });
        const j = await r.json();
        if (j.status === 'success' || j.status === 'reverted' || j.blockNumber) {
          clearInterval(t);
        }
      }, 4000);
    }
    return () => t && clearInterval(t);
  }, [txHash]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Badges</h1>

      <div className="space-y-2">
        <label className="text-sm text-neutral-500">Destination wallet (EVM)</label>
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="0x..."
          value={to}
          onChange={e => setTo(e.target.value)}
        />
        {!valid && to && <div className="text-xs text-red-600">Invalid address</div>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {BADGES.map(b => (
          <div key={b.slug} className="border rounded-2xl p-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image} alt={b.title} className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="font-semibold">{b.title}</div>
              <div className="text-sm text-neutral-500">{b.description}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-xs text-neutral-500">Price ${PRICES_USD[PAID_PATH].toFixed(2)}</div>
              <PayButton
                price={PRICES_USD[PAID_PATH]}
                description={`Pay to mint ${b.title}`}
                perform={async () => {
                  const r = await fetch(`/api/buy/meta?path=${encodeURIComponent(PAID_PATH)}`);
                  if (!r.ok) throw new Error(`HTTP ${r.status}`);
                  await onPaid(b.slug);
                  return { ok: true } as const;
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {txHash && (
        <div className="text-sm">
          Mint tx: <a className="underline" href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer">{txHash}</a>
        </div>
      )}
    </div>
  );
}
