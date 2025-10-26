# API инварианты

Порядок: **cache-hit → generate → cache upsert → side-effects**.

## pro/
- Списываем кредит `consume_credit` только после успешной авторизации.
- На cache-hit кредит не списываем повторно.

## paid/
- Всегда `requireX402`.
- Кредиты не трогаем.
- На miss пишем `paid_events` со статусом `settled`. На hit — без новой записи.

## Запреты
- Нет импортов `@supabase/supabase-js` внутри `src/app/api/**`.
- Не читаем `user_id` из body/query/searchParams — только из JWT.
- В каждом `/api`: `export const runtime = 'nodejs'`.
