export function isAdmin(userId: string): boolean {
    const ids = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    return ids.includes(userId);
}
