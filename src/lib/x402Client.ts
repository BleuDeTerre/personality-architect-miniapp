// src/lib/x402Client.ts
// x402 v2 серверная часть - реэкспорт из x402Guard.ts для обратной совместимости

// Реэкспорт всех функций из x402Guard
export { requireX402, withX402, withX402Handler } from './x402Guard';

// Реэкспорт серверных утилит
export { getX402Server, getNetworkId, getPayTo, createRouteAccepts } from './x402Server';
export type { X402RouteConfig } from './x402Server';
