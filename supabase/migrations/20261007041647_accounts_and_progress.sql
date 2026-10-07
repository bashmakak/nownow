-- NowNow: учётные записи и прогресс. ПРИМЕНЕНО к проекту 7 октября 2026 года.
-- Пароли здесь не хранятся: ими занимается служба входа Supabase (схема auth), в открытом виде их нет нигде.

-- 1. Отметка о согласии с документами. Пишется один раз при регистрации, с сайта её изменить нельзя.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  terms_version text check (char_length(terms_version) <= 20),
  privacy_version text check (char_length(privacy_version) <= 20),
  consent_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Согласие пользователя с документами: версии и время. Строка создаётся при регистрации.';

-- 2. Прогресс: одна строка на человека, всё состояние учёбы одним документом.
create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(state) = 'object' and octet_length(state::text) < 1000000),
  rev integer not null default 0,
  updated_at timestamptz not null default now()
);
comment on table public.progress is 'Прогресс пользователя. rev растёт при каждой записи: по нему сайт замечает, что другое устройство успело записать раньше.';

-- 3. Доступ: каждый видит и меняет только свою строку.
alter table public.profiles enable row level security;
alter table public.progress enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "progress: read own" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "progress: insert own" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "progress: update own" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Права выдаём явно и по минимуму. Без входа таблицы недоступны совсем.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.progress from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.progress to authenticated;
grant insert (user_id, state) on table public.progress to authenticated;
grant update (state) on table public.progress to authenticated;

-- 4. Номер версии и время записи ставит база, а не сайт.
create function public.progress_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.rev := case when tg_op = 'UPDATE' then old.rev + 1 else 1 end;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.progress_stamp() from public, anon, authenticated;
create trigger progress_stamp before insert or update on public.progress
  for each row execute function public.progress_stamp();

-- 5. При регистрации записываем, с какими версиями документов человек согласился.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, terms_version, privacy_version, consent_at)
  values (
    new.id,
    left(new.raw_user_meta_data ->> 'terms_version', 20),
    left(new.raw_user_meta_data ->> 'privacy_version', 20),
    case when new.raw_user_meta_data ? 'terms_version' then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
