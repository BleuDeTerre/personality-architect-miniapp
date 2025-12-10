export const FREE = new Set<string>([
    '/api/habits', '/api/habits/complete', '/api/habits/logs',
    '/api/wheel/trends', '/api/wheel/save', '/api/health'
]);

export const PAID = new Map<string, { sku: string; credits?: number }>([
    ['/api/pro/insight/weekly', { sku: 'pro_weekly', credits: 1 }],
    ['/api/pro/insight/habit', { sku: 'pro_habit', credits: 1 }],
    ['/api/pro/insight/monthly', { sku: 'pro_monthly', credits: 1 }],
    ['/api/paid/export', { sku: 'export_pdf' }],
]);

export function isFree(path: string) { return FREE.has(path); }
export function paidInfo(path: string) { return PAID.get(path); }
