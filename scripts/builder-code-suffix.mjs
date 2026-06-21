// RU: одноразовый скрипт — считает правильный ERC-8021 dataSuffix для билдер-кода
// Запуск: node scripts/builder-code-suffix.mjs
import { Attribution } from 'ox/erc8021';

const CODE = process.argv[2] || 'bc_iw2vv6l7';
const suffix = Attribution.toDataSuffix({ codes: [CODE] });

console.log('builder code :', CODE);
console.log('dataSuffix   :', suffix);
console.log('length bytes :', (suffix.length - 2) / 2);
console.log('ends with marker 8021? :', /8021$/.test(suffix));
