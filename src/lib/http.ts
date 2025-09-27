// RU: fetch с таймаутом/ретраями и маппингом ошибок оплаты (402)

export type FetchOpts = RequestInit & {
    timeoutMs?: number;
    retries?: number;
};

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
    const { timeoutMs = 15000, retries = 0, ...init } = opts;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });

        if (res.status === 402) {
            const j = await res.json().catch(() => ({}));
            throw Object.assign(new Error('payment_required'), { code: 402, detail: j });
        }

        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw Object.assign(new Error(`http_${res.status}`), { code: res.status, detail: j });
        }

        return await res.json();
    } catch (e: any) {
        if (retries > 0 && (e.name === 'AbortError' || e.code >= 500)) {
            return fetchJson<T>(url, { ...opts, retries: retries - 1 });
        }
        throw e;
    } finally {
        clearTimeout(t);
    }
}
