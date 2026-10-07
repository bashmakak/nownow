-- NowNow: проверка правил доступа. Запускается в SQL Editor панели Supabase.
--
-- Создаёт двух придуманных пользователей, пробует от имени каждого читать и менять чужое и в конце
-- всё откатывает: в базе ничего не остаётся. Результат приходит как текст «ошибки» TEST RESULT.
-- Ожидаемый ответ:
--   profiles=2 consentA=1 noConsentB=1 revA=1 updA=1 revA2=2 staleUpd=0 foreignInsert=denied(42501)
--   setRev=denied(42501) updProfile=denied(42501) insProfile=denied(42501) profilesVisibleToA=1
--   big=denied(23514) array=denied(23514) authUsersRead=denied(42501) rowsVisibleToB=0 BupdA=0
--   BseesProfileA=0 anonProgress=denied(42501) anonProfiles=denied(42501) anonInsert=denied(42501)
-- Слово ALLOWED в ответе означает дыру в правилах.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  r text := ''; n int; v int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a-test@nownow.example', '{"terms_version":"2026-10-07","privacy_version":"2026-10-07"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-test@nownow.example', '{}', now(), now());
  select count(*) into n from public.profiles where id in (a, b); r := r || ' profiles=' || n;
  select count(*) into n from public.profiles where id = a and terms_version = '2026-10-07' and consent_at is not null; r := r || ' consentA=' || n;
  select count(*) into n from public.profiles where id = b and consent_at is null; r := r || ' noConsentB=' || n;

  -- первый пользователь
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.progress (user_id, state) values (a, '{"x":1}');
  select rev into v from public.progress where user_id = a; r := r || ' revA=' || v;
  update public.progress set state = '{"x":2}' where user_id = a and rev = 1; get diagnostics n = row_count; r := r || ' updA=' || n;
  select rev into v from public.progress where user_id = a; r := r || ' revA2=' || v;
  update public.progress set state = '{"x":3}' where user_id = a and rev = 1; get diagnostics n = row_count; r := r || ' staleUpd=' || n;
  begin insert into public.progress (user_id, state) values (b, '{}'); r := r || ' foreignInsert=ALLOWED'; exception when others then r := r || ' foreignInsert=denied(' || sqlstate || ')'; end;
  begin update public.progress set rev = 99 where user_id = a; r := r || ' setRev=ALLOWED'; exception when others then r := r || ' setRev=denied(' || sqlstate || ')'; end;
  begin update public.profiles set terms_version = 'x' where id = a; get diagnostics n = row_count; r := r || ' updProfile=rows' || n; exception when others then r := r || ' updProfile=denied(' || sqlstate || ')'; end;
  begin insert into public.profiles (id) values (gen_random_uuid()); r := r || ' insProfile=ALLOWED'; exception when others then r := r || ' insProfile=denied(' || sqlstate || ')'; end;
  select count(*) into n from public.profiles; r := r || ' profilesVisibleToA=' || n;
  begin update public.progress set state = jsonb_build_object('big', repeat('x', 1100000)) where user_id = a; r := r || ' big=ALLOWED'; exception when others then r := r || ' big=denied(' || sqlstate || ')'; end;
  begin update public.progress set state = '[1]' where user_id = a; r := r || ' array=ALLOWED'; exception when others then r := r || ' array=denied(' || sqlstate || ')'; end;
  begin perform 1 from auth.users limit 1; r := r || ' authUsersRead=ALLOWED'; exception when others then r := r || ' authUsersRead=denied(' || sqlstate || ')'; end;

  -- второй пользователь пробует добраться до данных первого
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.progress; r := r || ' rowsVisibleToB=' || n;
  update public.progress set state = '{"hacked":true}' where user_id = a; get diagnostics n = row_count; r := r || ' BupdA=' || n;
  select count(*) into n from public.profiles where id = a; r := r || ' BseesProfileA=' || n;

  -- посетитель без входа
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin select count(*) into n from public.progress; r := r || ' anonProgress=ALLOWED' || n; exception when others then r := r || ' anonProgress=denied(' || sqlstate || ')'; end;
  begin select count(*) into n from public.profiles; r := r || ' anonProfiles=ALLOWED' || n; exception when others then r := r || ' anonProfiles=denied(' || sqlstate || ')'; end;
  begin insert into public.progress (user_id, state) values (a, '{}'); r := r || ' anonInsert=ALLOWED'; exception when others then r := r || ' anonInsert=denied(' || sqlstate || ')'; end;

  raise exception 'TEST RESULT:%', r;   -- откатывает всё, что сделано выше
end $$;
