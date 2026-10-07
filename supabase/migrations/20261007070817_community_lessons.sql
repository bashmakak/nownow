-- NowNow: авторские уроки, модерация и искры.
--
-- Как это устроено:
--   автор пишет урок в lesson_drafts → отправляет на проверку → модератор одобряет или возвращает с комментарием;
--   одобренная копия попадает в lessons_public, и только её видят читатели. Правки автора после одобрения
--   меняют черновик, а опубликованная копия остаётся прежней до следующего одобрения.
--   За одобренный урок и за каждого, кто его прошёл, автору начисляются искры (таблица ledger).
--
-- Искры — внутренние очки сайта. Денежной стоимости у них нет, вывода нет. Размеры начислений заданы
-- в функциях review_lesson и complete_lesson: 50 за первую публикацию урока, 5 за каждого нового
-- учащегося, ещё 2, если он отметил урок полезным.

-- ---------- 1. Автор: публичное имя, под которым выходят уроки ----------
create table public.authors (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40 and lower(name) !~ '(nownow|редакци|модератор|админ)'),
  bio text not null default '' check (char_length(bio) <= 300),
  created_at timestamptz not null default now()
);
create unique index authors_name_unique on public.authors (lower(btrim(name)));
comment on table public.authors is 'Публичный профиль автора: имя и пара строк о себе. Адреса почты здесь нет.';

-- ---------- 2. Модераторы: назначаются владельцем сайта в базе, с сайта таблицу изменить нельзя ----------
create table public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.moderators is 'Кто может одобрять и скрывать авторские уроки. Строки добавляет владелец сайта в SQL Editor.';

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- ---------- 3. Черновики: рабочая версия урока, видна автору, а на проверке — ещё и модератору ----------
create table public.lesson_drafts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.authors (user_id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) < 120000),
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'rejected')),
  note text not null default '' check (char_length(note) <= 2000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lesson_drafts_author on public.lesson_drafts (author_id);
create index lesson_drafts_queue on public.lesson_drafts (submitted_at) where status = 'review';
comment on table public.lesson_drafts is 'Черновики авторских уроков. status: draft — пишется, review — на проверке, approved — одобрен, rejected — возвращён с комментарием (note).';

-- ---------- 4. Опубликованные уроки: одобренная копия, её видят все ----------
create table public.lessons_public (
  id uuid primary key references public.lesson_drafts (id) on delete cascade,
  author_id uuid not null references public.authors (user_id) on delete cascade,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  topic text not null,
  level smallint not null,
  format text not null,
  tags text[] not null default '{}',
  minutes smallint not null default 5,
  content jsonb not null,
  hidden boolean not null default false,
  hidden_by text check (hidden_by in ('author', 'moderator')),
  learners integer not null default 0,
  useful integer not null default 0,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_public_recent on public.lessons_public (published_at desc) where not hidden;
create index lessons_public_author on public.lessons_public (author_id);
comment on table public.lessons_public is 'Опубликованные авторские уроки. Строки создаёт только функция review_lesson после решения модератора.';

-- ---------- 5. Прохождения, журнал искр, жалобы ----------
create table public.completions (
  lesson_id uuid not null references public.lessons_public (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  useful boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);
create index completions_user_recent on public.completions (user_id, created_at);
comment on table public.completions is 'Кто прошёл какой авторский урок: нужно, чтобы искры за одного человека начислялись один раз.';

create table public.ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('published', 'learner', 'useful', 'adjust')),
  lesson_id uuid references public.lesson_drafts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ledger_user_recent on public.ledger (user_id, id desc);
comment on table public.ledger is 'Журнал искр автора. Баланс — сумма amount. Записи создают только функции базы.';

create table public.reports (
  id bigint generated always as identity primary key,
  lesson_id uuid not null references public.lessons_public (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 5 and 600),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);
create index reports_open on public.reports (created_at) where not resolved;
comment on table public.reports is 'Жалобы читателей на опубликованные уроки. Видны автору жалобы и модераторам.';

-- ---------- 6. Правила доступа ----------
alter table public.authors enable row level security;
alter table public.moderators enable row level security;
alter table public.lesson_drafts enable row level security;
alter table public.lessons_public enable row level security;
alter table public.completions enable row level security;
alter table public.ledger enable row level security;
alter table public.reports enable row level security;

-- опубликованный урок видят все; скрытый — только его автор и модераторы
create policy "lessons: anyone reads visible" on public.lessons_public
  for select to anon using (not hidden);
create policy "lessons: read visible, own and moderated" on public.lessons_public
  for select to authenticated using (not hidden or (select auth.uid()) = author_id or (select public.is_moderator()));

-- имя автора видно всем, когда у него есть опубликованный урок; до этого — только ему самому и модераторам
create policy "authors: anyone reads published authors" on public.authors
  for select to anon using (exists (select 1 from public.lessons_public l where l.author_id = user_id and not l.hidden));
create policy "authors: read own, published and moderated" on public.authors
  for select to authenticated using ((select auth.uid()) = user_id or (select public.is_moderator())
    or exists (select 1 from public.lessons_public l where l.author_id = user_id and not l.hidden));
create policy "authors: create own" on public.authors
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "authors: update own" on public.authors
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "moderators: read own row" on public.moderators
  for select to authenticated using ((select auth.uid()) = user_id);

-- черновик читает автор; модератор видит только то, что отправлено на проверку
create policy "drafts: read own or in review" on public.lesson_drafts
  for select to authenticated using ((select auth.uid()) = author_id or (status = 'review' and (select public.is_moderator())));
create policy "drafts: create own" on public.lesson_drafts
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "drafts: edit own unless in review" on public.lesson_drafts
  for update to authenticated using ((select auth.uid()) = author_id and status <> 'review') with check ((select auth.uid()) = author_id);
create policy "drafts: remove own" on public.lesson_drafts
  for delete to authenticated using ((select auth.uid()) = author_id);

create policy "completions: read own" on public.completions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ledger: read own" on public.ledger
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "reports: read own or moderated" on public.reports
  for select to authenticated using ((select auth.uid()) = user_id or (select public.is_moderator()));
create policy "reports: create own" on public.reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reports: moderators resolve" on public.reports
  for update to authenticated using ((select public.is_moderator())) with check ((select public.is_moderator()));

-- права выдаём явно и по минимуму
revoke all on table public.authors, public.moderators, public.lesson_drafts, public.lessons_public, public.completions, public.ledger, public.reports from anon, authenticated;
grant select on table public.lessons_public to anon, authenticated;
grant select on table public.authors to anon, authenticated;
grant insert (user_id, name, bio) on table public.authors to authenticated;
grant update (name, bio) on table public.authors to authenticated;
grant select on table public.moderators to authenticated;
grant select, delete on table public.lesson_drafts to authenticated;
grant insert (author_id, data) on table public.lesson_drafts to authenticated;
grant update (data) on table public.lesson_drafts to authenticated;
grant select on table public.completions to authenticated;
grant select on table public.ledger to authenticated;
grant select on table public.reports to authenticated;
grant insert (lesson_id, user_id, reason) on table public.reports to authenticated;
grant update (resolved) on table public.reports to authenticated;

-- ---------- 7. Черновик: ограничение числа уроков и возврат в статус «пишется» после правки ----------
create function public.lesson_drafts_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.lesson_drafts where author_id = new.author_id) >= 50 then
      raise exception 'too many lessons' using errcode = '54000';
    end if;
    new.status := 'draft'; new.note := ''; new.submitted_at := null; new.reviewed_at := null; new.reviewed_by := null;
  elsif new.data is distinct from old.data and old.status in ('approved', 'rejected') then
    -- урок изменили после решения модератора: его нужно отправить на проверку заново
    new.status := 'draft';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.lesson_drafts_guard() from public, anon, authenticated;
create trigger lesson_drafts_guard before insert or update on public.lesson_drafts
  for each row execute function public.lesson_drafts_guard();

-- ---------- 8. Действия автора ----------
create function public.submit_lesson(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if (select count(*) from public.lesson_drafts where author_id = uid and status = 'review') >= 5 then
    raise exception 'too many lessons in review' using errcode = '54000';
  end if;
  update public.lesson_drafts set status = 'review', submitted_at = now()
  where id = p_id and author_id = uid and status in ('draft', 'rejected');
  if not found then raise exception 'lesson cannot be submitted' using errcode = 'P0002'; end if;
end $$;

create function public.withdraw_lesson(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.lesson_drafts set status = 'draft' where id = p_id and author_id = uid and status = 'review';
  if not found then raise exception 'lesson is not in review' using errcode = 'P0002'; end if;
end $$;

-- автор снимает свой урок с публикации и возвращает его; модератор скрывает и открывает любой.
-- Урок, скрытый модератором, автор сам вернуть не может.
create function public.set_lesson_hidden(p_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  mod boolean := public.is_moderator();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.lessons_public
  set hidden = p_hidden, hidden_by = case when not p_hidden then null when mod then 'moderator' else 'author' end, updated_at = now()
  where id = p_id and (mod or (author_id = uid and (p_hidden or hidden_by = 'author')));
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
end $$;

-- ---------- 9. Решение модератора ----------
create function public.review_lesson(p_id uuid, p_approve boolean, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  d public.lesson_drafts%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if uid is null or not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  select * into d from public.lesson_drafts where id = p_id and status = 'review' for update;
  if not found then raise exception 'lesson is not in review' using errcode = 'P0002'; end if;

  if not p_approve then
    if char_length(v_note) < 5 then raise exception 'a note is required' using errcode = '22023'; end if;
    update public.lesson_drafts set status = 'rejected', note = left(v_note, 2000), reviewed_at = now(), reviewed_by = uid where id = p_id;
    return;
  end if;

  if char_length(coalesce(d.data ->> 'title', '')) not between 5 and 90
     or coalesce(d.data ->> 'topic', '') = ''
     or coalesce(d.data ->> 'format', '') not in ('theory', 'practice', 'case')
     or coalesce(d.data ->> 'level', '') not in ('1', '2', '3')
     or jsonb_typeof(d.data -> 'check') is distinct from 'array'
     or jsonb_array_length(d.data -> 'check') < 3 then
    raise exception 'lesson is incomplete' using errcode = '22023';
  end if;

  insert into public.lessons_public (id, author_id, slug, title, summary, topic, level, format, tags, minutes, content)
  values (
    d.id, d.author_id, 'u-' || substr(replace(d.id::text, '-', ''), 1, 12),
    d.data ->> 'title', coalesce(d.data ->> 'summary', ''), d.data ->> 'topic', (d.data ->> 'level')::smallint, d.data ->> 'format',
    array(select jsonb_array_elements_text(case when jsonb_typeof(d.data -> 'tags') = 'array' then d.data -> 'tags' else '[]'::jsonb end)),
    case when coalesce(d.data ->> 'minutes', '') ~ '^[0-9]{1,2}$' then least(greatest((d.data ->> 'minutes')::int, 1), 30) else 5 end,
    d.data)
  on conflict (id) do update set
    title = excluded.title, summary = excluded.summary, topic = excluded.topic, level = excluded.level, format = excluded.format,
    tags = excluded.tags, minutes = excluded.minutes, content = excluded.content, updated_at = now(), hidden = false, hidden_by = null;

  update public.lesson_drafts set status = 'approved', note = left(v_note, 2000), reviewed_at = now(), reviewed_by = uid where id = p_id;

  -- искры за публикацию: один раз на урок, повторное одобрение после правок их не добавляет
  insert into public.ledger (user_id, amount, kind, lesson_id)
  select d.author_id, 50, 'published', d.id
  where not exists (select 1 from public.ledger where lesson_id = d.id and kind = 'published');
end $$;

-- ---------- 10. Прохождение урока: искры автору ----------
create function public.complete_lesson(p_lesson uuid, p_useful boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  v_author uuid;
  n integer;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select author_id into v_author from public.lessons_public where id = p_lesson and not hidden;
  if not found or v_author = uid then return; end if;       -- свой урок искр не приносит

  if not exists (select 1 from public.completions where lesson_id = p_lesson and user_id = uid) then
    -- не больше 30 новых уроков в сутки с одной учётной записи: защита от накрутки
    if (select count(*) from public.completions where user_id = uid and created_at > now() - interval '1 day') >= 30 then return; end if;
    insert into public.completions (lesson_id, user_id) values (p_lesson, uid) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then
      update public.lessons_public set learners = learners + 1 where id = p_lesson;
      insert into public.ledger (user_id, amount, kind, lesson_id) values (v_author, 5, 'learner', p_lesson);
    end if;
  end if;

  if p_useful then
    update public.completions set useful = true where lesson_id = p_lesson and user_id = uid and not useful;
    get diagnostics n = row_count;
    if n > 0 then
      update public.lessons_public set useful = useful + 1 where id = p_lesson;
      insert into public.ledger (user_id, amount, kind, lesson_id) values (v_author, 2, 'useful', p_lesson);
    end if;
  end if;
end $$;

-- баланс автора: сумма журнала и разбивка по видам начислений
create function public.wallet() returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'balance', coalesce(sum(amount), 0),
    'published', coalesce(sum(amount) filter (where kind = 'published'), 0),
    'learners', coalesce(sum(amount) filter (where kind = 'learner'), 0),
    'useful', coalesce(sum(amount) filter (where kind = 'useful'), 0))
  from public.ledger where user_id = (select auth.uid());
$$;

revoke execute on function public.submit_lesson(uuid), public.withdraw_lesson(uuid), public.set_lesson_hidden(uuid, boolean),
  public.review_lesson(uuid, boolean, text), public.complete_lesson(uuid, boolean), public.wallet() from public, anon;
grant execute on function public.submit_lesson(uuid), public.withdraw_lesson(uuid), public.set_lesson_hidden(uuid, boolean),
  public.review_lesson(uuid, boolean, text), public.complete_lesson(uuid, boolean), public.wallet() to authenticated;
