# 🔐 Настройка безопасности

## Обзор

Этот документ описывает настройку всех компонентов безопасности для Personality Architect Mini App.

---

## 1. ✅ Vercel (уже настроено)

Vercel предоставляет встроенную защиту от DDoS:
- Автоматическая защита от ботнетов
- Rate limiting на уровне инфраструктуры
- Защита от основных типов атак

**Статус:** ✅ Уже используется

---

## 2. 🌐 Cloudflare (рекомендуется)

### Что это?

Cloudflare - это CDN и защита от DDoS, которая работает перед вашим приложением. Она фильтрует трафик до того, как он достигнет Vercel.

### Это бесплатно?

**Да!** Cloudflare имеет бесплатный план (Free Plan), который включает:
- ✅ DDoS защиту
- ✅ CDN (кэширование)
- ✅ SSL сертификаты
- ✅ Базовый WAF (Web Application Firewall)
- ✅ Rate limiting (ограниченный)

### Как настроить?

#### Шаг 1: Регистрация

1. Перейдите на [cloudflare.com](https://www.cloudflare.com)
2. Зарегистрируйтесь (бесплатно)
3. **ВАЖНО:** Добавьте ваш **кастомный домен** (домен `*.vercel.app` **не подходит** для Cloudflare)
   - Нужно купить домен (например, через Namecheap, GoDaddy) - от $10-15/год
   - Или использовать бесплатный домен (не рекомендуется для production)

#### Шаг 2: Настройка DNS

1. Cloudflare предоставит вам DNS серверы (например, `alice.ns.cloudflare.com`)
2. В настройках вашего домена (где вы купили домен) измените DNS серверы на Cloudflare
3. Добавьте A-записи для вашего домена:
   - `@` → IP адрес Vercel (или CNAME на `cname.vercel-dns.com`)
   - `www` → IP адрес Vercel (или CNAME)

#### Шаг 3: Настройка в Vercel

1. В Vercel Dashboard → Settings → Domains
2. Добавьте ваш домен (который теперь на Cloudflare)
3. Vercel автоматически настроит SSL

#### Шаг 4: Настройка WAF правил (опционально)

В Cloudflare Dashboard → Security → WAF:

1. **Создайте правило для блокировки ботов:**
   ```
   (http.user_agent contains "bot" or http.user_agent contains "crawler")
   → Block
   ```

2. **Создайте правило для rate limiting:**
   - Security → WAF → Rate limiting rules
   - Настройте лимиты для разных endpoints

#### Шаг 5: Настройка в коде

✅ **Уже настроено!** `middleware.ts` и `src/lib/rate-limit.ts` уже поддерживают Cloudflare IP:
- `middleware.ts` использует `cf-connecting-ip` для определения IP
- `rate-limit.ts` также поддерживает Cloudflare заголовки

**Примечание:** Cloudflare требует **свой домен** (не `*.vercel.app`). Если у вас нет домена, можно работать без Cloudflare - middleware уже защищает от ботов.

**Статус:** ⚠️ Опционально, но рекомендуется для production (требует свой домен)

---

## 3. 🔒 Rate Limiting

### Что уже сделано?

✅ Создан универсальный rate limiter в `src/lib/rate-limit.ts`
✅ Применен к ключевым endpoints:
- `/api/export/data` - строгий лимит (5 запросов/минуту)
- `/api/chat/message` - строгий лимит для AI (20 запросов/минуту)
- `/api/goals` - средний лимит (100-200 запросов/минуту)

### Как применить к другим endpoints?

Добавьте в начало handler функции:

```typescript
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
    // Rate limiting
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.API);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }
    
    // ... ваш код
}
```

### Предустановленные конфигурации:

- `RATE_LIMIT_PRESETS.AUTH` - для аутентификации (10/мин)
- `RATE_LIMIT_PRESETS.API` - для обычных API (100/мин)
- `RATE_LIMIT_PRESETS.READ` - для чтения данных (200/мин)
- `RATE_LIMIT_PRESETS.AI` - для AI endpoints (20/мин)
- `RATE_LIMIT_PRESETS.EXPORT` - для экспорта (5/мин)

**Статус:** ✅ Реализовано, нужно применить к остальным endpoints

---

## 4. 🗄️ RLS (Row Level Security) Политики

### Что сделано?

✅ Создана SQL миграция `sql/add_missing_rls_policies.sql`

### Как применить?

1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте содержимое `sql/add_missing_rls_policies.sql`
3. Выполните миграцию
4. Проверьте результат:

```sql
-- Проверка всех таблиц с RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Проверка всех политик
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Какие таблицы защищены?

- ✅ `goals` - пользователи видят только свои цели
- ✅ `habits` - пользователи видят только свои привычки
- ✅ `habit_logs` - пользователи видят только свои логи
- ✅ `user_plans` - пользователи видят только свои планы
- ✅ `wheel_entries` - пользователи видят только свои записи
- ✅ `wheel_scores` - пользователи видят только свои оценки
- ✅ `users` - публичные профили (все могут читать, только владелец может обновлять)
- ✅ `chat_messages` - уже было защищено
- ✅ `daily_wellness_metrics` - уже было защищено
- ✅ `subtasks` - уже было защищено
- ✅ `user_profile_settings` - уже было защищено

**Статус:** ✅ Миграция создана, нужно выполнить в Supabase

---

## 5. 🔐 Security Headers

### Что уже настроено?

В `middleware.ts` уже есть:
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Что уже настроено?

✅ **Security Headers:**
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (блокировка камеры, микрофона, геолокации)
- `Strict-Transport-Security` (HSTS) - только для production
- `X-XSS-Protection` - только для production
- `Content-Security-Policy` (CSP) - только для production

✅ **Блокировка ботов по User-Agent:**
- Автоматическая блокировка известных сканеров (ahrefsbot, mj12bot, semrushbot, dotbot, petalbot, bytespider)
- Логирование всех блокировок для мониторинга
- Возвращает 403 Forbidden для заблокированных ботов

✅ **Определение IP адреса:**
- Поддержка Cloudflare (`cf-connecting-ip`)
- Поддержка Vercel (`x-forwarded-for`)
- Fallback на `x-real-ip`

**Примечание:** `X-Frame-Options: DENY` отключен, потому что Farcaster Mini App открывается в iframe.

**Статус:** ✅ Все базовые заголовки и защита от ботов настроены

---

## 6. 🔑 Secrets Management

### Что уже настроено?

✅ Все API ключи хранятся в Vercel Environment Variables
✅ Нет хардкода ключей в коде

### Рекомендации:

1. **Никогда не коммитьте `.env` файлы**
   - Убедитесь что `.env*` в `.gitignore`

2. **Используйте разные ключи для dev/staging/production**
   - В Vercel можно настроить разные environment variables для разных окружений

3. **Регулярно ротируйте ключи**
   - Меняйте API ключи каждые 3-6 месяцев

4. **Для production (опционально):**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault

**Статус:** ✅ Базовое управление через Vercel

---

## 7. 🔐 MFA (Multi-Factor Authentication)

### Как включить?

1. Откройте Supabase Dashboard → Authentication → Providers
2. Включите MFA (Multi-Factor Authentication)
3. Настройте методы: TOTP (Google Authenticator, Authy)

### Для пользователей:

Пользователи смогут включить MFA в настройках профиля (если добавите UI).

**Статус:** ⚠️ Опционально, можно включить в Supabase

---

## 8. 📊 Мониторинг и логирование

### Что уже есть?

✅ Логирование подозрительных запросов в `src/lib/rate-limit.ts`
✅ Логирование в консоль для отладки

### Рекомендации:

1. **Настройте Vercel Logs:**
   - Vercel Dashboard → Logs
   - Настройте алерты на ошибки

2. **Используйте Sentry (опционально):**
   ```bash
   npm install @sentry/nextjs
   ```

3. **Мониторинг подозрительной активности:**
   - Отслеживайте частые 429 ошибки (rate limit)
   - Отслеживайте частые 401 ошибки (неудачные попытки входа)

**Статус:** ⚠️ Базовое логирование есть, можно улучшить

---

## 9. ✅ Чеклист безопасности

### Критично (сделать немедленно):

- [ ] Выполнить SQL миграцию `sql/add_missing_rls_policies.sql` в Supabase
- [ ] Проверить что все таблицы имеют RLS политики
- [ ] Протестировать: попробовать получить данные другого пользователя (должно быть запрещено)

### Важно (сделать в ближайшее время):

- [ ] Применить rate limiting к остальным API endpoints
- [ ] Настроить Cloudflare (опционально, но рекомендуется)
- [ ] Настроить мониторинг подозрительной активности

### Опционально (можно сделать позже):

- [ ] Включить MFA в Supabase
- [ ] Настроить Sentry для мониторинга ошибок
- [ ] Настроить автоматические бэкапы БД
- [ ] Регулярно обновлять зависимости (`npm audit`)

---

## 10. 🧪 Тестирование безопасности

### Тест 1: RLS политики

```sql
-- В Supabase SQL Editor от имени другого пользователя
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'OTHER_USER_UUID';
SELECT * FROM goals; -- Должно вернуть только свои цели (пусто если у другого пользователя нет целей)
```

### Тест 2: Rate Limiting

```bash
# Попробуйте сделать 100+ запросов подряд
for i in {1..150}; do
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://your-app.com/api/goals
done
# После 100 запросов должен вернуться 429
```

### Тест 3: Доступ к чужим данным

```bash
# С токеном пользователя A попробуйте получить данные пользователя B
curl -H "Authorization: Bearer TOKEN_A" \
  https://your-app.com/api/goals?user_id=USER_B_UUID
# Должно вернуть пустой массив или ошибку (благодаря RLS)
```

---

## 📚 Дополнительные ресурсы

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Vercel Security Best Practices](https://vercel.com/docs/security)
- [Cloudflare Free Plan Features](https://www.cloudflare.com/plans/free/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Последнее обновление:** 2024
