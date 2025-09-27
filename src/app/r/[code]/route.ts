import { NextResponse, NextRequest } from 'next/server';

// GET /r/abcd → ставим куку refcode=abcd на 14 дней и редиректим на /
export async function GET(req: NextRequest, ctx: { params: { code: string } } | any) {
    const code = String(ctx.params.code || '').trim().toLowerCase();
    const url = new URL('/', req.url); // при желании поменяй на /signup

    const res = NextResponse.redirect(url);
    if (code) {
        res.cookies.set('refcode', code, {
            path: '/',
            httpOnly: false,     // можно читать на клиенте
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 14, // 14 дней
        });
    }
    return res;
}
