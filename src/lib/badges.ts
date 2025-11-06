// RU: каталог доступных бейджей. tokenId задаём заранее в вашей коллекции 1155.

/**
 * Placeholder изображение для бейджей (используется пока дизайнеры готовят реальные NFT)
 * Когда будут готовы реальные изображения, просто замените эту константу или URL в поле image каждого бейджа
 */
export const BADGE_PLACEHOLDER_IMAGE = '/share/images/badges.png';

export type Badge = {
    slug: 'FIRST_LOG' | 'STREAK_7' | 'STREAK_30' | 'STREAK_60' | 'STREAK_100' | 'STREAK_365' | 'WHEEL_70' | 'WHEEL_80' | 'CONSISTENT_21' | 'SHARE_3';
    title: string;          // EN
    description: string;    // EN
    tokenId: bigint;        // RU: токен в вашем 1155 контракте
    image: string;          // RU: URL для превью (можно IPFS/HTTPS, локальный путь, или placeholder)
};

/**
 * Каталог всех бейджей
 * 
 * 📝 КАК ДОБАВИТЬ РЕАЛЬНЫЕ ИЗОБРАЖЕНИЯ NFT:
 * 
 * 1. После создания NFT в Zora, получите IPFS хэш из метаданных токена
 * 2. Используйте IPFS Gateway URL (рекомендуется):
 *    image: 'https://gateway.pinata.cloud/ipfs/QmXXXXX...'
 *    или
 *    image: 'https://ipfs.io/ipfs/QmXXXXX...'
 * 
 * 3. Или используйте локальный файл:
 *    image: '/badges/first-log.png'
 * 
 * 4. Просто замените значение поля 'image' в нужном бейдже ниже
 * 
 * Пример:
 * { slug: 'FIRST_LOG', ..., image: 'https://gateway.pinata.cloud/ipfs/QmXXXXX...' }
 */
export const BADGES: Badge[] = [
    { slug: 'FIRST_LOG', title: 'First Log', description: 'Logged your first habit.', tokenId: BigInt(1), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'STREAK_7', title: 'Streak 7', description: '7-day habit streak.', tokenId: BigInt(2), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'STREAK_30', title: 'Streak 30', description: '30-day habit streak.', tokenId: BigInt(3), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'STREAK_60', title: 'Streak 60', description: '60-day habit streak.', tokenId: BigInt(8), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'STREAK_100', title: 'Streak 100', description: '100-day habit streak.', tokenId: BigInt(9), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'STREAK_365', title: 'Streak 365', description: '365-day habit streak!', tokenId: BigInt(10), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'WHEEL_70', title: 'Wheel 70', description: 'Reached 70/100 on Wheel of Life.', tokenId: BigInt(4), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'WHEEL_80', title: 'Wheel 80', description: 'Reached 80/100 on Wheel of Life.', tokenId: BigInt(5), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'CONSISTENT_21', title: 'Consistent 21', description: '21 days of consistent tracking.', tokenId: BigInt(6), image: BADGE_PLACEHOLDER_IMAGE },
    { slug: 'SHARE_3', title: 'Share x3', description: 'Shared 3 insights to Farcaster.', tokenId: BigInt(7), image: BADGE_PLACEHOLDER_IMAGE },
];

export function getBadge(slug: Badge['slug']): Badge | undefined {
    return BADGES.find(b => b.slug === slug);
}
