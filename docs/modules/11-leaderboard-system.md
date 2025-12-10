# Leaderboard System (Система лидерборда)

## 📋 Обзор

Система лидерборда показывает топ пользователей по XP, стрикам и активности. Поддерживает пагинацию и отображение позиции текущего пользователя.

---

## 🔌 API Endpoint

### Leaderboard

**GET** `/api/leaderboard?page=1&limit=20`

**Параметры:**
- `page` - номер страницы (опционально)
- `limit` - количество на странице (опционально)
- Без параметров - возвращает топ-50

**Ответ:**
```json
{
  "entries": [
    {
      "user_id": "uuid",
      "fid": 12345,
      "current_streak": 15,
      "best_streak": 30,
      "total_logs": 250,
      "total_xp": 1500,
      "neynar_profile": {
        "username": "user123",
        "display_name": "User Name",
        "pfp_url": "https://...",
        "follower_count": 100
      }
    }
  ],
  "viewer": "current_user_id",
  "userPosition": 42,
  "userEntry": {
    // Только если пользователь не в топ-50
  },
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

**Логика:**

1. **Получение всех пользователей:**
   - Запрос всех пользователей из таблицы `users`

2. **Расчет статистики для каждого пользователя:**
   - **Стрики:** RPC `get_habit_streak`
   - **Логи:** COUNT из `habit_logs`
   - **XP:** RPC `get_user_total_xp`

3. **Сортировка:**
   - По `total_xp` (по убыванию)
   - При равенстве - по `best_streak`
   - При равенстве - по `total_logs`

4. **Пагинация:**
   - Если указаны `page` и `limit` - применяется пагинация
   - Без пагинации - возвращается топ-50

5. **Обогащение профилями:**
   - Получение профилей из `farcaster_profiles`
   - JOIN с данными лидерборда

6. **Позиция пользователя:**
   - Поиск позиции текущего пользователя в полном списке
   - Если не в топ-50 - возврат отдельно

7. **Кеширование:**
   - Server-side cache на 5 минут
   - `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`

**Файл:** `src/app/api/leaderboard/route.ts`

---

## 🗄️ База данных

### Таблица `farcaster_profiles`

```sql
CREATE TABLE farcaster_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fid INTEGER UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  bio TEXT,
  follower_count INTEGER,
  following_count INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, fid)
);
```

**Поля:**
- Профиль пользователя из Farcaster/Neynar
- Обновляется при входе пользователя

---

## 🎨 Frontend компоненты

### 1. LeaderboardPage (`src/app/leaderboard/page.tsx`)

**Основные функции:**
- Отображение списка лидеров
- Пагинация
- Показ позиции текущего пользователя
- Отображение профилей (аватар, имя, статистика)

**Состояние:**
```typescript
const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
const [userPosition, setUserPosition] = useState<number | null>(null);
const [loading, setLoading] = useState(true);
```

---

## 📊 Расчеты

### Сортировка

```typescript
const sorted = entries.sort((a, b) => {
  // 1. По XP
  if (b.total_xp !== a.total_xp) {
    return b.total_xp - a.total_xp;
  }
  // 2. По лучшему стрику
  if (b.best_streak !== a.best_streak) {
    return b.best_streak - a.best_streak;
  }
  // 3. По количеству логов
  return b.total_logs - a.total_logs;
});
```

### Позиция пользователя

```typescript
const userPosition = sorted.findIndex(e => e.user_id === userId) + 1;
```

---

## 🔄 Интеграция с другими модулями

### 1. Gamification System

**Данные:**
- `total_xp` - общий XP пользователя
- Рассчитывается через RPC `get_user_total_xp`

---

### 2. Habits System

**Данные:**
- `current_streak` - текущий стрик
- `best_streak` - лучший стрик
- `total_logs` - общее количество логов
- Рассчитываются через RPC `get_habit_streak` и COUNT

---

### 3. Authentication System

**Данные:**
- Профили из `farcaster_profiles`
- Обновляются при входе пользователя

---

## 🔐 Безопасность

### Row Level Security (RLS)

**Политики:**
- Пользователь может видеть всех в лидерборде
- Профили доступны всем (публичные данные)

**Проверка:**
- Endpoint проверяет авторизацию для определения позиции пользователя

---

## 🚀 Оптимизации

### 1. Server-side Caching

- Кеширование на 5 минут
- `stale-while-revalidate` для плавного обновления

### 2. Batch Operations

- Параллельный расчет статистики для всех пользователей
- Один запрос для получения профилей

### 3. Пагинация

- Поддержка пагинации для больших списков
- Обратная совместимость (топ-50 без пагинации)

---

## 🐛 Известные проблемы

1. **Производительность при большом количестве пользователей:**
   - Расчет статистики для всех пользователей может быть медленным
   - Решено через кеширование и пагинацию

2. **Обновление профилей:**
   - Профили обновляются только при входе
   - Могут быть устаревшими

---

## 📝 Примечания

- **Сортировка:** По XP → best_streak → total_logs
- **Кеш:** 5 минут на сервере
- **Пагинация:** Опциональна, по умолчанию топ-50
- **Позиция пользователя:** Всегда показывается, даже если не в топ-50

