# API Invariants

Order: **cache-hit → generate → cache upsert → side-effects**.

## pro/
- Deduct credit via `consume_credit` **only after** successful authorization.  
- On cache-hit, do **not** deduct credit again.

## paid/
- Always use `requireX402`.  
- Never modify user credits directly.  
- On cache miss, insert a record into `paid_events` with status `settled`.  
  On cache hit, skip inserting a new record.

## Restrictions
- No imports of `@supabase/supabase-js` inside `src/app/api/**`.  
- Never read `user_id` from body/query/searchParams — only from JWT.  
- Every `/api` route must declare:  
  ```ts
  export const runtime = 'nodejs';
