// RU: правильная генерация ERC-8021 dataSuffix для Base Builder Code.
// Док: https://docs.base.org/apps/builder-codes/app-developers
//
// ВАЖНО: билдер-код вешается на ON-CHAIN транзакции, которые шлёт ПРИЛОЖЕНИЕ
// (sendTransaction / writeContract / sendCalls) через поле dataSuffix.
// На x402-платежи (off-chain подпись + сеттлмент фасилитатором) его повесить нельзя —
// там нет транзакции, которую мы контролируем.

import { Attribution } from 'ox/erc8021';
import { hexToString, type Hex } from 'viem';

// В .env.local желательно держать человекочитаемый код: BUILDER_CODE=bc_iw2vv6l7
const RAW = process.env.BUILDER_CODE?.trim();

// RU: на случай если код по ошибке записан как сырой hex (0x...) — декодируем обратно в строку
function resolveCode(raw: string): string {
    if (raw.startsWith('0x')) {
        try {
            return hexToString(raw as Hex);
        } catch {
            return raw;
        }
    }
    return raw;
}

/**
 * Корректно закодированный ERC-8021 dataSuffix или undefined, если код не задан.
 * Передавать в dataSuffix любой on-chain транзакции приложения.
 */
export const BUILDER_CODE_SUFFIX: Hex | undefined = RAW
    ? (Attribution.toDataSuffix({ codes: [resolveCode(RAW)] }) as Hex)
    : undefined;

export const BUILDER_CODE_RAW = RAW ? resolveCode(RAW) : undefined;
