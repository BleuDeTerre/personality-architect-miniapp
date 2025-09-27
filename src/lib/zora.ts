// RU: утилиты для минта через Zora Creator 1155 на Base с помощью viem
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData, Hex, parseEther } from 'viem';
import { base } from 'viem/chains';

const CHAIN_ID = Number(process.env.ZORA_CHAIN_ID ?? 8453);
const RPC_URL = process.env.BASE_RPC_URL!;
const CONTRACT = process.env.ZORA_1155_CONTRACT as `0x${string}`;
const PK = process.env.MINT_WALLET_PRIVATE_KEY as Hex;
const REFERRAL = (process.env.ZORA_MINT_REFERRAL as `0x${string}`) ?? `0x0000000000000000000000000000000000000000`;

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
    account: PK,
});

export type MintArgs = {
    to: `0x${string}`;
    tokenId: bigint;
    quantity?: bigint;     // RU: обычно 1
    data?: Hex;            // RU: доп. данные, если нужно
    valueEth?: string;     // RU: если у вас платная чеканка — укажите цену в ETH строкой
};

export async function sendMint({ to, tokenId, quantity = BigInt(1), data, valueEth }: MintArgs) {
    const calldata = encodeFunctionData({
        abi: ABI,
        functionName: 'mintWithRewards',
        args: [to, tokenId, quantity, REFERRAL, data ?? '0x'],
    });

    const hash = await walletClient.sendTransaction({
        to: CONTRACT,
        data: calldata,
        value: valueEth ? parseEther(valueEth) : BigInt(0),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}
