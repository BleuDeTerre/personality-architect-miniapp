# Badges Images

Эта папка предназначена для хранения изображений бейджей.

## Имена файлов

Поместите изображения с следующими именами:

- `first-log.png` - для FIRST_LOG badge
- `streak-7.png` - для STREAK_7 badge
- `streak-30.png` - для STREAK_30 badge
- `streak-60.png` - для STREAK_60 badge
- `streak-100.png` - для STREAK_100 badge
- `streak-365.png` - для STREAK_365 badge
- `wheel-70.png` - для WHEEL_70 badge
- `wheel-80.png` - для WHEEL_80 badge
- `consistent-21.png` - для CONSISTENT_21 badge
- `share-3.png` - для SHARE_3 badge

## Формат

- Рекомендуется: PNG формат
- Размер: 1024x1024 px или больше

## Использование

После добавления файлов, обновите `src/lib/badges.ts`:

```typescript
image: '/badges/first-log.png'  // Локальный путь
```

## Переход на IPFS

Позже, при загрузке NFT в Zora, можно заменить локальные пути на IPFS URL:

```typescript
image: 'https://gateway.pinata.cloud/ipfs/QmXXXXX...'  // IPFS хэш из Zora
```

Подробнее см. `docs/BADGE_IMAGE_SETUP.md`
