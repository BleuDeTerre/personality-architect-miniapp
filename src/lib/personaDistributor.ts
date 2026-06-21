// RU: раздача наград $PERSONA on-chain на Base с прикреплением Builder Code (ERC-8021).
// Каждый transfer уходит с dataSuffix = BUILDER_CODE_SUFFIX → Base засчитывает билдер-код.
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { BUILDER_CODE_SUFFIX } from './builderCode';

const PK = process.env.REWARD_DISTRIBUTOR_PRIVATE_KEY as Hex | undefined;
const TOKEN = process.env.PERSONA_TOKEN_ADDRESS as `0x${string}` | undefined;
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const DECIMALS = 18n;

const account = PK ? privateKeyToAccount(PK) : undefined;

const erc20 = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
]);

export const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
export const walletClient = createWalletClient({ chain: base, transport: http(RPC_URL), account });

export const distributorAddress = account?.address;

export function validateDistributorConfig(): { ok: true } | { ok: false; missing: string[] } {
    const missing: string[] = [];
    if (!PK) missing.push('REWARD_DISTRIBUTOR_PRIVATE_KEY');
    if (!TOKEN) missing.push('PERSONA_TOKEN_ADDRESS');
    if (!BUILDER_CODE_SUFFIX) missing.push('BUILDER_CODE');
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/** Баланс $PERSONA на кошельке-казне (в целых токенах). */
export async function getTreasuryBalance(): Promise<bigint> {
    if (!account || !TOKEN) throw new Error('DISTRIBUTOR_NOT_CONFIGURED');
    const raw = await publicClient.readContract({
        address: TOKEN,
        abi: erc20,
        functionName: 'balanceOf',
        args: [account.address],
    });
    return raw / 10n ** DECIMALS;
}

/**
 * Шлёт награду одному юзеру и ЖДЁТ подтверждения.
 * amount — в целых токенах PERSONA. Возвращает hash и успех (по статусу receipt).
 * Нонс отдан viem (вызовы последовательные, без гонок).
 */
export async function sendPersonaReward(
    to: `0x${string}`,
    wholeTokens: bigint,
): Promise<{ hash: Hex; success: boolean }> {
    if (!account || !TOKEN) throw new Error('DISTRIBUTOR_NOT_CONFIGURED');
    const amount = wholeTokens * 10n ** DECIMALS;
    const data = encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [to, amount] });

    const hash = await walletClient.sendTransaction({
        account,
        to: TOKEN,
        data,
        chain: base,
        dataSuffix: BUILDER_CODE_SUFFIX, // ← Builder Code (ERC-8021) едет здесь
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 45_000 });
    return { hash, success: receipt.status === 'success' };
}
