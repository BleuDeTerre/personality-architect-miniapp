// RU: утилиты для минта через Zora Creator 1155 на Base с помощью viem
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData, Hex, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

export const CHAIN_ID = Number(process.env.ZORA_CHAIN_ID ?? 8453);
export const RPC_URL = process.env.BASE_RPC_URL as string;
export const CONTRACT = process.env.ZORA_1155_CONTRACT as `0x${string}` | undefined;
export const PK = process.env.MINT_WALLET_PRIVATE_KEY as Hex | undefined;
export const REFERRAL = (process.env.ZORA_MINT_REFERRAL as `0x${string}`) ?? `0x0000000000000000000000000000000000000000`;
export const BUILDER_CODE = process.env.BUILDER_CODE as `0x${string}` | undefined;

const walletAccount = PK ? privateKeyToAccount(PK) : undefined;

export function validateZoraConfig(): { ok: true } | { ok: false; missing: string[] } {
    const missing: string[] = [];
    if (!RPC_URL) missing.push('BASE_RPC_URL');
    if (!CONTRACT) missing.push('ZORA_1155_CONTRACT');
    if (!PK) missing.push('MINT_WALLET_PRIVATE_KEY');
    if (!CHAIN_ID) missing.push('ZORA_CHAIN_ID');
    return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

// RU: минимальный ABI Zora Creator 1155 (mintWithRewards). Уточните под ваш контракт при необходимости.
const ABI = parseAbi([
    'function mintWithRewards(address to, uint256 tokenId, uint256 quantity, address mintReferral, bytes data) payable',
]);

export const publicClient = createPublicClient({
    chain: CHAIN_ID === 8453 ? base : undefined, // RU: если другой chain — добавьте конфиг
    transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
    chain: CHAIN_ID === 8453 ? base : undefined,
    transport: http(RPC_URL),
    account: walletAccount,
});

export type MintArgs = {
    to: `0x${string}`;
    tokenId: bigint;
    quantity?: bigint;     // RU: обычно 1
    data?: Hex;            // RU: доп. данные, если нужно
    valueEth?: string;     // RU: если у вас платная чеканка — укажите цену в ETH строкой
};

export async function sendMint({ to, tokenId, quantity = BigInt(1), data, valueEth }: MintArgs) {
    const cfg = validateZoraConfig();
    if (cfg.ok === false) {
        throw new Error(`ZORA_CONFIG_MISSING: ${cfg.missing.join(', ')}`);
    }
    if (!walletAccount) {
        throw new Error('ZORA_WALLET_NOT_CONFIGURED');
    }
    if (!CONTRACT) {
        throw new Error('ZORA_CONTRACT_NOT_CONFIGURED');
    }
    const calldata = encodeFunctionData({
        abi: ABI,
        functionName: 'mintWithRewards',
        args: [to, tokenId, quantity, REFERRAL, data ?? '0x'],
    });

    const hash = await walletClient.sendTransaction({
        account: walletAccount,
        to: CONTRACT,
        data: calldata,
        value: valueEth ? parseEther(valueEth) : 0n,
        chain: CHAIN_ID === 8453 ? base : undefined,
        dataSuffix: BUILDER_CODE,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}
