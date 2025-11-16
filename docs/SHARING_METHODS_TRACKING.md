# Отслеживание методов Sharing

## Как определить, какой метод используется

Приложение теперь автоматически выбирает метод sharing в зависимости от окружения:

1. **Нативный метод (`composeCast`)** - используется, если приложение запущено внутри Farcaster Mini App
2. **API метод (`/api/share/cast`)** - используется как fallback, если приложение запущено в браузере или нативный метод недоступен

## Логирование

Все попытки sharing логируются в таблицу `events_log` с событием `share_method_used`. 

### Структура лога:

```typescript
{
  name: 'share_method_used',
  props: {
    method: 'native_composeCast' | 'api_publishCast',
    success: boolean,
    kind: string, // тип каста (streaks, goals, etc.)
    error: string | null // ошибка, если была
  }
}
```

## Как проверить статистику

### Через Supabase SQL:

```sql
-- Общая статистика по методам
SELECT 
  props->>'method' as method,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN (props->>'success')::boolean THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT (props->>'success')::boolean THEN 1 ELSE 0 END) as failed
FROM events_log
WHERE name = 'share_method_used'
GROUP BY props->>'method';

-- Статистика по типам кастов
SELECT 
  props->>'kind' as kind,
  props->>'method' as method,
  COUNT(*) as count
FROM events_log
WHERE name = 'share_method_used'
GROUP BY props->>'kind', props->>'method'
ORDER BY count DESC;

-- Ошибки
SELECT 
  props->>'method' as method,
  props->>'error' as error,
  COUNT(*) as count
FROM events_log
WHERE name = 'share_method_used' 
  AND (props->>'success')::boolean = false
GROUP BY props->>'method', props->>'error'
ORDER BY count DESC;
```

### Через API (если нужно):

Можно создать endpoint для аналитики, который будет агрегировать эти данные.

## Рекомендации

1. **Мониторинг**: Регулярно проверяйте статистику, чтобы понять, какой метод работает лучше
2. **Ошибки**: Если видите много ошибок в одном из методов, это может указывать на проблему
3. **Удаление нерабочего метода**: Если один из методов постоянно падает с ошибками, можно:
   - Удалить его из кода
   - Или оставить только рабочий метод как основной

## Текущая логика

В `ShareCastComposer.tsx`:

```typescript
// Проверяем, в Mini App ли мы
const isInMiniApp = isRunningInMiniApp();

if (isInMiniApp) {
  // Используем нативный метод
  await composeCast(selected.text, embeds);
} else {
  // Используем API метод
  await fetch('/api/share/cast', { ... });
}
```

## Что делать, если один метод не работает

1. Проверьте логи в `events_log` таблице
2. Посмотрите на процент успешных/неуспешных попыток
3. Если один метод постоянно падает:
   - Проверьте консоль браузера на ошибки
   - Проверьте логи сервера (Vercel logs)
   - Убедитесь, что все переменные окружения настроены правильно

## Удаление нерабочего метода

Если решите удалить один из методов:

1. **Удалить нативный метод**: Удалите блок `if (isInMiniApp)` и оставьте только API метод
2. **Удалить API метод**: Удалите блок `else` и оставьте только нативный метод (но учтите, что это будет работать только в Mini App)

Рекомендуется оставить оба метода для максимальной совместимости.

