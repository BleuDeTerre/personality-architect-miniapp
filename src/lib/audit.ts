export async function logPaidError(supa: any, path: string, sku: string, msg: string, status = '402') {
    try {
        await supa.rpc('log_event', {
            p_name: 'paid_error',
            p_status: status,
            p_path: path,
            p_amount_cents: null,
            p_props: { sku, msg }
        });
    } catch { }
}

export async function consumeProCredit(supa: any, period = 'pro-monthly') {
    try { await supa.rpc('consume_credit', { p_period: period }); } catch { }
}
