// RU: read-only проверка — приватники в env (адреса) + структура Supabase. Ничего не пишет.
// Запуск: node scripts/check-setup.mjs
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';

const TARGET = '0x515DA686E8091aCEa86960330Cbce1Dc2e561738'.toLowerCase();

console.log('=== ПРИВАТНИКИ в env → адрес (ключи НЕ печатаются) ===');
for (const [k, v] of Object.entries(process.env)) {
    if (!/PRIVATE_KEY/i.test(k)) continue;
    if (!v) { console.log(`${k}: (пусто)`); continue; }
    try {
        let pk = v.trim();
        if (!pk.startsWith('0x')) pk = '0x' + pk;
        const acc = privateKeyToAccount(pk);
        const match = acc.address.toLowerCase() === TARGET ? '   <<< ЭТО 0x515D (КАЗНА)' : '';
        console.log(`${k}: ${acc.address}${match}`);
    } catch (e) {
        console.log(`${k}: (невалидный ключ: ${String(e.message).slice(0, 40)})`);
    }
}

console.log('\n=== SUPABASE (только чтение структуры) ===');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('нет url/service key'); process.exit(0); }
const supa = createClient(url, key, { auth: { persistSession: false } });

for (const table of ['xp_events', 'users', 'persona_rewards']) {
    const { data, error, count } = await supa.from(table).select('*', { count: 'exact' }).limit(1);
    if (error) { console.log(`${table}: НЕТ / ошибка → ${error.message}`); continue; }
    const cols = data && data[0] ? Object.keys(data[0]).join(', ') : '(таблица пуста)';
    console.log(`${table}: есть, строк=${count}, колонки: ${cols}`);
}

{
    const { count, error } = await supa.from('users').select('*', { count: 'exact', head: true }).not('wallet', 'is', null);
    if (!error) console.log(`users с заполненным wallet: ${count}`);
}
{
    const { count, error } = await supa.from('users').select('*', { count: 'exact', head: true }).not('wallet_address', 'is', null);
    if (!error) console.log(`users с заполненным wallet_address: ${count}`);
}
