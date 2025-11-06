-- sql/add_farcaster_profiles.sql
-- Создает таблицу для кеша профилей Neynar

create table if not exists public.farcaster_profiles (
    user_id uuid primary key references public.users (id) on delete cascade,
    fid bigint not null,
    username text,
    display_name text,
    pfp_url text,
    bio text,
    follower_count integer,
    following_count integer,
    updated_at timestamptz not null default now()
);

create unique index if not exists farcaster_profiles_fid_idx
    on public.farcaster_profiles (fid);
