import { NextRequest, NextResponse } from 'next/server';

type GuardResult = NextResponse | null;

// Псевдо-валидация. Подставьте свою проверку (заголовок, сигнатура, фасилитатор и т.п.).
function isPaid(req: NextRequest): boolean {
    // пример: требуется заголовок x-402-proof
    const proof = req.headers.get('x-402-proof');
    return !!proof; // верните реальную проверку
}

// Императивный гард: вернуть Response(402) или null
export function requireX402(req: NextRequest, sku: string): GuardResult {
    if (!isPaid(req)) {
        return NextResponse.json(
            { error: 'payment_required', sku },
            { status: 402 }
        );
    }
    return null;
}

// Обёртка-декоратор: не бросает, всегда даёт 402 при отсутствии оплаты
export function withX402<T extends (req: NextRequest) => Promise<Response>>(
    handler: T,
    { sku }: { sku: string }
) {
    return async (req: NextRequest) => {
        const block = requireX402(req, sku);
        if (block) return block;
        try {
            return await handler(req);
        } catch (e: any) {
            // не маскируем оплату 500-кой
            return NextResponse.json(
                { error: e?.message || 'internal' },
                { status: 500 }
            );
        }
    };
}
