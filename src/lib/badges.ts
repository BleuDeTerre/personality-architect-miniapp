// RU: каталог доступных бейджей. tokenId задаём заранее в вашей коллекции 1155.
export type Badge = {
    slug: 'FIRST_LOG' | 'STREAK_7' | 'STREAK_30' | 'WHEEL_70' | 'WHEEL_80' | 'CONSISTENT_21' | 'SHARE_3';
    title: string;          // EN
    description: string;    // EN
    tokenId: bigint;        // RU: токен в вашем 1155 контракте
    image: string;          // RU: URL для превью (можно IPFS/HTTPS)
};

export const BADGES: Badge[] = [
    { slug: 'FIRST_LOG', title: 'First Log', description: 'Logged your first habit.', tokenId: BigInt(1), image: '/share/images/badges.png' },
    { slug: 'STREAK_7', title: 'Streak 7', description: '7-day habit streak.', tokenId: BigInt(2), image: '/share/images/badges.png' },
    { slug: 'STREAK_30', title: 'Streak 30', description: '30-day habit streak.', tokenId: BigInt(3), image: '/share/images/badges.png' },
    { slug: 'WHEEL_70', title: 'Wheel 70', description: 'Reached 70/100 on Wheel of Life.', tokenId: BigInt(4), image: '/share/images/badges.png' },
    { slug: 'WHEEL_80', title: 'Wheel 80', description: 'Reached 80/100 on Wheel of Life.', tokenId: BigInt(5), image: '/share/images/badges.png' },
    { slug: 'CONSISTENT_21', title: 'Consistent 21', description: '21 days of consistent tracking.', tokenId: BigInt(6), image: '/share/images/badges.png' },
    { slug: 'SHARE_3', title: 'Share x3', description: 'Shared 3 insights to Farcaster.', tokenId: BigInt(7), image: '/share/images/badges.png' },
];

export function getBadge(slug: Badge['slug']): Badge | undefined {
    return BADGES.find(b => b.slug === slug);
}
