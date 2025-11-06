# 📸 Настройка изображений для бейджей

## Краткий ответ

### ❓ Обязательно ли IPFS?
**НЕТ, не обязательно!** Но рекомендуется для NFT метаданных в Zora.

### 📐 В каком формате?
**PNG** (1024x1024 px или больше) — лучший вариант для NFT и UI.

---

## Подробное объяснение

### 1️⃣ Изображения для Zora NFT (когда создаете токены)

**Когда**: При создании токенов в Zora Creator (https://create.zora.co/)

**Формат**:
- ✅ **PNG** (рекомендуется) — 1024x1024 или 2048x2048 px
- ✅ **JPEG** — тоже работает, но PNG лучше (поддержка прозрачности)
- ❌ **SVG** — обычно не поддерживается для NFT метаданных

**Размер файла**: До 10-20 MB (обычно достаточно 1-3 MB)

**Где загружать**:
1. **Простой способ** (рекомендуется): 
   - Просто загрузите файл через интерфейс Zora Creator
   - Zora автоматически загрузит на IPFS за вас! ✨
   - Вы получите IPFS URL типа `ipfs://Qm...`

2. **Вручную через IPFS**:
   - Загрузите на Pinata (pinata.cloud) или NFT.Storage (nft.storage)
   - Получите IPFS URL
   - Вставьте в Zora

3. **HTTP URL** (не рекомендуется):
   - Можно указать URL с вашего сервера
   - Риск: если сервер упадет, изображение пропадет
   - NFT метаданные должны быть постоянными!

**Вывод**: Используйте интерфейс Zora — они сами загрузят на IPFS бесплатно!

---

### 2️⃣ Изображения для UI приложения (превью в вашем приложении)

**Когда**: Для отображения в `/profile`, `/badges` и других страницах

**🎯 ЛУЧШИЙ ВАРИАНТ: Использовать IPFS URL из Zora!**

После загрузки изображений в Zora, они автоматически получают IPFS URL вида:
- `ipfs://QmXXXXX...` (нативный IPFS URL)
- Или можете использовать через IPFS Gateway: `https://ipfs.io/ipfs/QmXXXXX...`

**Как использовать IPFS Gateway в приложении:**

После создания токенов в Zora, вы получите IPFS хэши. Используйте их через gateway:

```typescript
// В src/lib/badges.ts
export const BADGES: Badge[] = [
  { 
    slug: 'FIRST_LOG', 
    title: 'First Log', 
    description: 'Logged your first habit.', 
    tokenId: BigInt(1), 
    image: 'https://ipfs.io/ipfs/QmXXXXX...'  // ← IPFS gateway URL из Zora
  },
  // ... и так далее
];
```

**Популярные IPFS Gateway:**
- `https://ipfs.io/ipfs/` - публичный gateway (может быть медленным)
- `https://gateway.pinata.cloud/ipfs/` - быстрый gateway от Pinata
- `https://cloudflare-ipfs.com/ipfs/` - Cloudflare gateway

**Альтернатива: Ваш сервер** (если нужна большая скорость):
```
/public/badges/
  ├── first-log.png
  ├── streak-7.png
  └── ...
```

**Вывод**: Используйте IPFS URL из Zora через gateway — не нужно дублировать файлы! 🎯

---

## Практический пример

### Шаг 1: Создайте изображения

Создайте 10 PNG файлов:
```
first-log.png      (1024x1024)
streak-7.png       (1024x1024)
streak-30.png      (1024x1024)
streak-60.png      (1024x1024)
streak-100.png     (1024x1024)
streak-365.png     (1024x1024)
wheel-70.png       (1024x1024)
wheel-80.png       (1024x1024)
consistent-21.png  (1024x1024)
share-3.png        (1024x1024)
```

### Шаг 2: Для Zora NFT

1. Зайдите на https://create.zora.co/
2. Создайте токен с Token ID = 1
3. Загрузите `first-log.png` через их интерфейс
4. Zora автоматически загрузит на IPFS
5. Повторите для остальных токенов (Token ID 2-10)

### Шаг 3: Для вашего приложения

**Вариант А: Использовать IPFS URL из Zora (рекомендуется)** ✅

После создания токенов в Zora, скопируйте IPFS хэши из метаданных токенов и используйте их:

```typescript
// В src/lib/badges.ts
export const BADGES: Badge[] = [
  { 
    slug: 'FIRST_LOG', 
    title: 'First Log', 
    description: 'Logged your first habit.', 
    tokenId: BigInt(1), 
    image: 'https://gateway.pinata.cloud/ipfs/QmXXXXX...'  // ← IPFS хэш из Zora
  },
  { 
    slug: 'STREAK_7', 
    title: 'Streak 7', 
    description: '7-day habit streak.', 
    tokenId: BigInt(2), 
    image: 'https://gateway.pinata.cloud/ipfs/QmYYYYY...'  // ← IPFS хэш из Zora
  },
  // ... и так далее
];
```

**Где найти IPFS хэш:**
- В Zora Creator, после загрузки изображения, вы увидите IPFS URL
- Или проверьте метаданные токена на Zora/OpenSea

**Вариант Б: Локальные файлы (если нужна максимальная скорость)** 

1. Скопируйте файлы в `/public/badges/`:
   ```bash
   mkdir -p public/badges
   cp first-log.png public/badges/
   cp streak-7.png public/badges/
   # ... и так далее
   ```

2. Обновите `src/lib/badges.ts`:
   ```typescript
   image: '/badges/first-log.png'  // ← Локальный путь
   ```

**Рекомендация**: Используйте IPFS URL из Zora — один источник истины! 🎯

---

## Итоговая таблица

| Место | Формат | Размер | IPFS обязательно? | Где хранить |
|-------|--------|--------|-------------------|-------------|
| **Zora NFT метаданные** | PNG/JPEG | 1024x1024+ | ✅ Рекомендуется | Zora (автоматически загружает на IPFS) |
| **UI приложения** | PNG (через IPFS) | 1024x1024+ | ✅ Используйте IPFS URL из Zora | IPFS Gateway или `/public/badges/` |

---

## FAQ

### ❓ Можно ли использовать только Zora IPFS URL для UI?
**Да!** Это лучший вариант — используйте IPFS gateway URL из Zora напрямую в приложении. Не нужно дублировать файлы!

**Пример:**
```typescript
image: 'https://gateway.pinata.cloud/ipfs/QmXXXXX...'  // IPFS хэш из Zora
```

### ❓ Зачем тогда хранить на своем сервере?
Только если нужна максимальная скорость загрузки. Но обычно IPFS gateway достаточно быстрый, особенно через Pinata или Cloudflare.

### ❓ Нужно ли оптимизировать изображения?
- Для Zora: Нет, используйте оригинал высокого качества
- Для UI: Можно, но не обязательно (современные браузеры хорошо работают с PNG)

### ❓ Что если я не хочу использовать IPFS для Zora?
Вы можете использовать HTTP URL, но это не рекомендуется:
- Риск потери изображения, если сервер упадет
- NFT метаданные должны быть постоянными
- Большинство NFT маркетплейсов ожидают IPFS

### ❓ Могу ли я использовать SVG?
- Для Zora: Обычно нет (проверьте документацию Zora)
- Для UI: Да, но PNG надежнее и работает везде

---

**Вывод**: 
1. Создайте PNG файлы 1024x1024
2. Загрузите в Zora через их интерфейс (они сами загрузят на IPFS)
3. Скопируйте IPFS хэши из Zora
4. Используйте IPFS gateway URL в `badges.ts`:
   ```typescript
   image: 'https://gateway.pinata.cloud/ipfs/QmXXXXX...'
   ```

**Один источник истины — только Zora!** 🎯

Не нужно дублировать файлы на сервере, если используете IPFS gateway.

