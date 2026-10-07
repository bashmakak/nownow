-- NowNow: удаление своей учётной записи одной кнопкой. ПОКА НЕ ПРИМЕНЕНО.
--
-- Без этой функции кнопка «Удалить учётную запись» в кабинете оставляет заявку: прогресс человека
-- в облаке стирается сразу, а запись с адресом почты владелец сайта удаляет вручную (см. README.md рядом).
-- С функцией запись удаляется сразу, вместе с прогрессом и отметкой о согласии. Сайт сам замечает,
-- что функция появилась: менять и публиковать его заново не нужно.
--
-- Как применить: панель Supabase → SQL Editor → вставить этот файл целиком → Run.
--
-- Функция удаляет только того, кто её вызвал: идентификатор берётся из входа, а не из параметров.
-- Вызвать её без входа нельзя.
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
