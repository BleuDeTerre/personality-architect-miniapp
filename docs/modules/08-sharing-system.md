# Система шаринга (Sharing System)

## 📋 Обзор

Система шаринга позволяет пользователям делиться своим прогрессом в Farcaster через касты с красивыми превью изображениями. Поддерживает различные типы контента (streaks, habits, goals, wheel) с автоматической генерацией OG изображений.

---

## 🔌 API Endpoints

### 1. Публикация каста

**POST** `/api/share/cast`

**Тело запроса:**
```json
{
  "kind": "streaks",
  "title": "7 Day Streak!",
  "text": "Just completed 7 days in a row! 🔥",
  "previewParams": {
    "variant": "streaks:7days",
    "statValue": "7",
    "statLabel": "Day Streak"
  },
  "embedUrl": "https://app.com/api/share/preview?kind=streaks&variant=streaks:7days",
  "targetUrl": "https://app.com/streaks"
}
```

**Ответ:**
```json
{
  "hash": "0x...",
  "castUrl": "https://warpcast.com/~/cast/0x...",
  "previewUrl": "https://app.com/api/share/preview?..."
}
```

**Логика:**
1. **Валидация:**
   - Проверка наличия `NEYNAR_SIGNER_UUID`
   - Валидация текста (максимум 320 символов)
   - Обрезка заголовка (максимум 64 символа)

2. **Генерация preview URL:**
   - Использование `embedUrl` или `/api/share/preview`
   - Добавление параметров для генерации изображения
   - Передача `kind` для правильного цвета
   - Ограничение длины URL (максимум 2000 символов)

3. **Публикация через Neynar:**
   - Использование `publishCast()` из `@/lib/neynar`
   - Передача текста и embed URL
   - Получение hash каста

4. **Логирование:**
   - Сохранение в `share_logs` для аналитики

**Файл:** `src/app/api/share/cast/route.ts`

---

### 2. Генерация OG изображения

**GET** `/api/share/og`

**Параметры:**
- `kind` - тип контента (streaks, habits, goals, wheel)
- `variant` - вариант отображения
- `statValue`, `statLabel` - статистика
- `description` - описание
- `tag` - тег

**Ответ:** PNG изображение (1200x630px)

**Логика:**
1. Парсинг параметров из query string
2. Определение цвета на основе `kind`
3. Генерация изображения через `@vercel/og`
4. Возврат PNG

**Цвета по типам:**
- `streaks`: Красный/Оранжевый (#F87171, #FB923C)
- `habits`: Зеленый (#10B981, #34D399)
- `goals`: Синий (#3B82F6, #60A5FA)
- `wheel`: Фиолетовый (#8B5CF6, #A78BFA)
- По умолчанию: Фиолетовый

**Файл:** `src/app/api/share/og/route.tsx`

---

### 3. Preview страница

**GET** `/api/share/preview`

**Назначение:** HTML страница с OG тегами для правильного отображения в Farcaster

**Логика:**
1. Генерация OG тегов на основе параметров
2. Использование `/api/share/og` для изображения
3. Возврат HTML с мета-тегами

**Файл:** `src/app/api/share/preview/route.tsx`

---

### 4. Логирование шаринга

**POST** `/api/share/log`

**Тело запроса:**
```json
{
  "type": "cast",
  "content_type": "streaks",
  "metadata": {
    "hash": "0x...",
    "kind": "streaks"
  }
}
```

**Логика:**
- Сохранение в `share_logs` для аналитики
- Отслеживание популярных типов контента

**Файл:** `src/app/api/share/log/route.ts`

---

## 🗄️ База данных

### Таблица `share_logs`

```sql
CREATE TABLE share_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'cast', 'link'
  content_type TEXT,   -- 'streaks', 'habits', 'goals', 'wheel'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🎨 Frontend компоненты

### 1. ShareCastComposer (`src/components/share/ShareCastComposer.tsx`)

**Назначение:** Компонент для создания и публикации кастов

**Функции:**
- Отображение списка шаблонов
- Предпросмотр изображения
- Редактирование текста
- Публикация каста
- Подтверждение перед публикацией (опционально)

**Шаблоны:**
```typescript
type CastTemplate = {
  key: string;
  title: string;
  text: string;
  kind: string;
  previewParams?: Record<string, string | number | boolean>;
  targetPath?: string;
  publishMode?: 'auto' | 'confirm';
};
```

**Режимы публикации:**
- `auto` - автоматическая публикация
- `confirm` - требует подтверждения

---

### 2. Интеграция в страницы

**Habits Page:**
- Шаблоны для streaks, habits summary
- Автоматическая генерация текста

**Streaks Page:**
- Шаблоны для различных стриков
- Кастомные тексты

**Goals Page:**
- Шаблоны для достижения целей
- Прогресс по целям

**Wheel Page:**
- Шаблоны для обновлений Wheel
- Выходные шаринг

---

## 🔄 Интеграция с Neynar

### Публикация каста

```typescript
import { publishCast } from '@/lib/neynar';

const result = await publishCast(
  signerUuid,
  text,
  embeds  // [{ url: previewUrl }]
);

// Возвращает: { hash, castUrl }
```

**Файл:** `src/lib/neynar.ts`

---

## 📊 Типы контента

### 1. Streaks

**Варианты:**
- `streaks:3days` - 3 дня стрика
- `streaks:7days` - 7 дней стрика
- `streaks:30days` - 30 дней стрика
- `streaks:custom` - кастомный стрик

**Цвет:** Красный/Оранжевый

---

### 2. Habits

**Варианты:**
- `habits:summary` - общая статистика
- `habits:top` - топ привычка
- `habits:perfect` - идеальный день

**Цвет:** Зеленый

---

### 3. Goals

**Варианты:**
- `goals:achievement` - достижение цели
- `goals:progress` - прогресс по цели
- `goals:summary` - общая статистика

**Цвет:** Синий

---

### 4. Wheel

**Варианты:**
- `wheel:update` - обновление Wheel
- `wheel:balance` - баланс жизни
- `wheel:improvement` - улучшение области

**Цвет:** Фиолетовый

---

## 🔐 Безопасность

### Проверка авторизации

- Все endpoints проверяют `user_id` через `requireUserFromReq()`
- Публикация кастов только для авторизованных пользователей

### Валидация данных

- Ограничение длины текста (320 символов)
- Ограничение длины заголовка (64 символа)
- Валидация URL (максимум 2000 символов)

---

## 🚀 Оптимизации

### 1. Кеширование изображений

- OG изображения генерируются динамически
- Можно добавить кеширование через CDN

### 2. Асинхронная публикация

- Публикация каста не блокирует UI
- Показ статуса публикации

---

## 🐛 Известные проблемы

1. **Длина URL:**
   - Farcaster/Neynar ограничивает длину embed URL (~2000 символов)
   - Решено через проверку длины перед публикацией

2. **Генерация изображений:**
   - Может быть медленной при большом количестве параметров
   - Решено через оптимизацию `@vercel/og`

---

## 📝 Примечания

- **Signer UUID:** Требуется `NEYNAR_SIGNER_UUID` для публикации
- **Preview:** Всегда генерируется перед публикацией
- **Логирование:** Все публикации логируются для аналитики
- **Шаблоны:** Используются для автоматической генерации текста

