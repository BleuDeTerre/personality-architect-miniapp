import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Оптимизация производительности
  compress: true, // Включить gzip компрессию
  
  // Оптимизация изображений (только для компонента next/image, не влияет на API роуты)
  // ВАЖНО: Касты используют API роуты /api/share/preview и /api/share/og,
  // поэтому эти настройки НЕ влияют на работу кастов
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Кеш для статических изображений (бейджи и т.д.)
    // НЕ влияет на динамические изображения из API роутов
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 дней
  },
  
  // SWC минификация включена по умолчанию в Next.js 16+
  // Не нужно указывать swcMinify явно
  
  // Экспериментальные оптимизации
  experimental: {
    optimizePackageImports: [
      '@neynar/react',
      'lucide-react',
      '@supabase/supabase-js',
    ],
  },
  
  // Оптимизация заголовков
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          // X-Frame-Options уже настроен в middleware.ts
          // Не дублируем здесь, чтобы не конфликтовать
        ],
      },
    ];
  },
};

export default nextConfig;
