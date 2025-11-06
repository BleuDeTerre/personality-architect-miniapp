'use client';

import { useState } from 'react';
import { BADGE_PLACEHOLDER_IMAGE } from '@/lib/badges';

interface BadgeImageProps {
    src: string;
    alt: string;
    className?: string;
}

/**
 * Компонент для отображения изображения бейджа с автоматическим fallback на placeholder
 * Если реальное изображение не загрузилось, автоматически показывается placeholder
 */
export default function BadgeImage({ src, alt, className = '' }: BadgeImageProps) {
    const [imgSrc, setImgSrc] = useState(src);
    const [hasError, setHasError] = useState(false);

    const handleError = () => {
        if (!hasError && imgSrc !== BADGE_PLACEHOLDER_IMAGE) {
            // Если ошибка и это не уже placeholder, переключаемся на placeholder
            setHasError(true);
            setImgSrc(BADGE_PLACEHOLDER_IMAGE);
        }
    };

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={imgSrc}
            alt={alt}
            className={className}
            onError={handleError}
        />
    );
}

