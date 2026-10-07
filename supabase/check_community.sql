-- NowNow: проверка правил для авторских уроков. Запускается в SQL Editor панели Supabase.
--
-- Создаёт трёх придуманных пользователей — автора, читателя и модератора, — проводит урок через весь путь
-- (черновик → проверка → возврат → правка → публикация → прохождение → жалоба → скрытие) и по дороге пробует
-- всё, чего делать нельзя. В конце всё откатывает: в базе ничего не остаётся.
-- Результат приходит как текст «ошибки» TEST RESULT. Ожидаемый ответ:
--   draftNoProfile=denied(23503) reservedName=denied(23514) newStatus=draft insertWithStatus=denied(42501)
--   selfApprove=denied(42501) selfPublish=denied(42501) selfCredit=denied(42501) selfModerator=denied(42501)
--   authorReviews=denied(42501) submitted=review editInReview=rows0 strangerSeesDrafts=0
--   strangerReviews=denied(42501) sameName=denied(23505) strangerSubmits=denied(P0002) queue=1
--   rejectNoNote=denied(22023) rejected=rejected afterEdit=draft published=1 slugOk=true anonLessons=1
--   anonAuthors=1 anonDrafts=denied(42501) anonLedger=denied(42501) anonComplete=denied(42501)
--   learners/useful=1/1 repeat=1/1 report=1 secondReport=denied(23505) wallet=57 ownLesson=57
--   authorSeesReports=0 authorSeesCompletions=0 authorHides=author authorUnhides=false modHides=moderator
--   authorUnhidesModerated=denied(42501) editApproved=draft publicUnchanged=true walletAfterRepublish=57
-- Слово ALLOWED в ответе означает дыру в правилах.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  l uuid; r text := ''; n int; t text; ok boolean; w json;
  body jsonb := '{"title":"Проверочный урок","summary":"Текст для проверки правил доступа","topic":"psihologiya","format":"theory","level":1,"tags":["Тест"],"minutes":4,"check":[{"q":"1"},{"q":"2"},{"q":"3"}]}';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'author-test@nownow.example', '{}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reader-test@nownow.example', '{}', now(), now()),
         (m, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderator-test@nownow.example', '{}', now(), now());
  insert into public.moderators (user_id) values (m);

  -- ---------- автор ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin insert into public.lesson_drafts (author_id, data) values (a, body); r := r || ' draftNoProfile=ALLOWED'; exception when others then r := r || ' draftNoProfile=denied(' || sqlstate || ')'; end;
  begin insert into public.authors (user_id, name) values (a, 'Редакция NowNow'); r := r || ' reservedName=ALLOWED'; exception when others then r := r || ' reservedName=denied(' || sqlstate || ')'; end;
  insert into public.authors (user_id, name, bio) values (a, 'Проверочный Автор', 'о себе');
  insert into public.lesson_drafts (author_id, data) values (a, body) returning id, status into l, t; r := r || ' newStatus=' || t;
  begin insert into public.lesson_drafts (author_id, data, status) values (a, body, 'approved'); r := r || ' insertWithStatus=ALLOWED'; exception when others then r := r || ' insertWithStatus=denied(' || sqlstate || ')'; end;
  begin update public.lesson_drafts set status = 'approved' where id = l; r := r || ' selfApprove=ALLOWED'; exception when others then r := r || ' selfApprove=denied(' || sqlstate || ')'; end;
  begin insert into public.lessons_public (id, author_id, slug, title, topic, level, format, content) values (l, a, 'u-test', 'x', 'x', 1, 'theory', '{}'); r := r || ' selfPublish=ALLOWED'; exception when others then r := r || ' selfPublish=denied(' || sqlstate || ')'; end;
  begin insert into public.ledger (user_id, amount, kind) values (a, 1000000, 'adjust'); r := r || ' selfCredit=ALLOWED'; exception when others then r := r || ' selfCredit=denied(' || sqlstate || ')'; end;
  begin insert into public.moderators (user_id) values (a); r := r || ' selfModerator=ALLOWED'; exception when others then r := r || ' selfModerator=denied(' || sqlstate || ')'; end;
  perform public.submit_lesson(l);
  begin perform public.review_lesson(l, true, ''); r := r || ' authorReviews=ALLOWED'; exception when others then r := r || ' authorReviews=denied(' || sqlstate || ')'; end;
  select status into t from public.lesson_drafts where id = l; r := r || ' submitted=' || t;
  update public.lesson_drafts set data = body || '{"title":"Изменено во время проверки"}' where id = l; get diagnostics n = row_count; r := r || ' editInReview=rows' || n;

  -- ---------- посторонний человек (он же потом читатель) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.lesson_drafts; r := r || ' strangerSeesDrafts=' || n;
  begin perform public.review_lesson(l, true, ''); r := r || ' strangerReviews=ALLOWED'; exception when others then r := r || ' strangerReviews=denied(' || sqlstate || ')'; end;
  begin insert into public.authors (user_id, name) values (b, ' проверочный автор '); r := r || ' sameName=ALLOWED'; exception when others then r := r || ' sameName=denied(' || sqlstate || ')'; end;
  begin perform public.submit_lesson(l); r := r || ' strangerSubmits=ALLOWED'; exception when others then r := r || ' strangerSubmits=denied(' || sqlstate || ')'; end;

  -- ---------- модератор: возврат с комментарием ----------
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select count(*) into n from public.lesson_drafts where status = 'review'; r := r || ' queue=' || n;
  begin perform public.review_lesson(l, false, '  '); r := r || ' rejectNoNote=ALLOWED'; exception when others then r := r || ' rejectNoNote=denied(' || sqlstate || ')'; end;
  perform public.review_lesson(l, false, 'Добавьте источник');

  -- ---------- автор правит и отправляет снова, модератор публикует ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select status into t from public.lesson_drafts where id = l; r := r || ' rejected=' || t;
  update public.lesson_drafts set data = body || '{"sources":["Источник"]}' where id = l;
  select status into t from public.lesson_drafts where id = l; r := r || ' afterEdit=' || t;
  perform public.submit_lesson(l);
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.review_lesson(l, true, '');
  select count(*), bool_and(slug ~ '^u-[0-9a-f]{12}$') into n, ok from public.lessons_public where id = l; r := r || ' published=' || n || ' slugOk=' || ok;

  -- ---------- посетитель без входа ----------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.lessons_public; r := r || ' anonLessons=' || n;
  select count(*) into n from public.authors; r := r || ' anonAuthors=' || n;
  begin select count(*) into n from public.lesson_drafts; r := r || ' anonDrafts=ALLOWED' || n; exception when others then r := r || ' anonDrafts=denied(' || sqlstate || ')'; end;
  begin select count(*) into n from public.ledger; r := r || ' anonLedger=ALLOWED' || n; exception when others then r := r || ' anonLedger=denied(' || sqlstate || ')'; end;
  begin perform public.complete_lesson(l, true); r := r || ' anonComplete=ALLOWED'; exception when others then r := r || ' anonComplete=denied(' || sqlstate || ')'; end;

  -- ---------- читатель проходит урок и жалуется ----------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.complete_lesson(l, false); perform public.complete_lesson(l, true);
  select learners || '/' || useful into t from public.lessons_public where id = l; r := r || ' learners/useful=' || t;
  perform public.complete_lesson(l, true); perform public.complete_lesson(l, false);
  select learners || '/' || useful into t from public.lessons_public where id = l; r := r || ' repeat=' || t;
  insert into public.reports (lesson_id, user_id, reason) values (l, b, 'Проверочная жалоба'); get diagnostics n = row_count; r := r || ' report=' || n;
  begin insert into public.reports (lesson_id, user_id, reason) values (l, b, 'Вторая жалоба'); r := r || ' secondReport=ALLOWED'; exception when others then r := r || ' secondReport=denied(' || sqlstate || ')'; end;

  -- ---------- автор: искры, чужие данные, снятие с публикации ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select public.wallet() into w; r := r || ' wallet=' || (w ->> 'balance');
  perform public.complete_lesson(l, true); select public.wallet() into w; r := r || ' ownLesson=' || (w ->> 'balance');
  select count(*) into n from public.reports; r := r || ' authorSeesReports=' || n;
  select count(*) into n from public.completions; r := r || ' authorSeesCompletions=' || n;
  perform public.set_lesson_hidden(l, true); select hidden_by into t from public.lessons_public where id = l; r := r || ' authorHides=' || t;
  perform public.set_lesson_hidden(l, false); select hidden into ok from public.lessons_public where id = l; r := r || ' authorUnhides=' || ok;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.set_lesson_hidden(l, true); select hidden_by into t from public.lessons_public where id = l; r := r || ' modHides=' || t;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.set_lesson_hidden(l, false); r := r || ' authorUnhidesModerated=ALLOWED'; exception when others then r := r || ' authorUnhidesModerated=denied(' || sqlstate || ')'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.set_lesson_hidden(l, false);

  -- ---------- правка опубликованного урока: прежняя версия остаётся до нового одобрения, вторых 50 искр нет ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.lesson_drafts set data = body || '{"title":"Проверочный урок, вторая редакция"}' where id = l;
  select status into t from public.lesson_drafts where id = l; r := r || ' editApproved=' || t;
  select title = 'Проверочный урок' into ok from public.lessons_public where id = l; r := r || ' publicUnchanged=' || ok;
  perform public.submit_lesson(l);
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.review_lesson(l, true, '');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select public.wallet() into w; r := r || ' walletAfterRepublish=' || (w ->> 'balance');

  raise exception 'TEST RESULT:%', r;   -- откатывает всё, что сделано выше
end $$;
