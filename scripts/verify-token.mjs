// RU: проверка задеплоенного токена и казны в сети Base
// Запуск: node scripts/verify-token.mjs <tokenAddress> <treasuryAddress>
import { createPublicClient, http, formatUnits, formatEther } from 'viem';
import { base } from 'viem/chains';

const TOKEN = process.argv[2];
const TREASURY = process.argv[3];

const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

const erc20 = [
    { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
    { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const [name, symbol, decimals, supply] = await Promise.all([
    client.readContract({ address: TOKEN, abi: erc20, functionName: 'name' }),
    client.readContract({ address: TOKEN, abi: erc20, functionName: 'symbol' }),
    client.readContract({ address: TOKEN, abi: erc20, functionName: 'decimals' }),
    client.readContract({ address: TOKEN, abi: erc20, functionName: 'totalSupply' }),
]);

console.log('=== TOKEN ===');
console.log('address  :', TOKEN);
console.log('name     :', name);
console.log('symbol   :', symbol);
console.log('decimals :', decimals);
console.log('supply   :', formatUnits(supply, decimals));

if (TREASURY) {
    const [tokenBal, ethBal] = await Promise.all([
        client.readContract({ address: TOKEN, abi: erc20, functionName: 'balanceOf', args: [TREASURY] }),
        client.getBalance({ address: TREASURY }),
    ]);
    console.log('');
    console.log('=== TREASURY', TREASURY, '===');
    console.log('PERSONA balance :', formatUnits(tokenBal, decimals));
    console.log('ETH balance     :', formatEther(ethBal), '(для газа)');
}
