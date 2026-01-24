'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BADGE_PLACEHOLDER_IMAGE } from '@/lib/badges';

interface BadgeImageProps {
    src: string;
    alt: string;
    className?: string;
    priority?: boolean; // Для изображений выше fold
}

/**
 * Компонент для отображения изображения бейджа с автоматическим fallback на placeholder
 * Если реальное изображение не загрузилось, автоматически показывается placeholder
 * Оптимизирован для использования Next.js Image оптимизации (WebP/AVIF)
 */
export default function BadgeImage({ src, alt, className = '', priority = false }: BadgeImageProps) {
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
        <Image
            src={imgSrc}
            alt={alt}
            className={className}
            width={256}
            height={256}
            onError={handleError}
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
            quality={85}
        />
    );
}

