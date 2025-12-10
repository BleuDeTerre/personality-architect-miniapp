export const FREE = new Set<string>([
    '/api/habits', '/api/habits/complete', '/api/habits/logs',
    '/api/wheel/trends', '/api/wheel/save', '/api/health'
]);

export const PAID = new Map<string, { sku: string; credits?: number }>([
    ['/api/paid/export', { sku: 'export_pdf' }],
]);

export function isFree(path: string) { return FREE.has(path); }
export function paidInfo(path: string) { return PAID.get(path); }
