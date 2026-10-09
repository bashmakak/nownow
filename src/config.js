/* ===== Подключение к базе (Supabase) =====

   Здесь лежат адрес проекта и ПУБЛИКУЕМЫЙ ключ. Оба значения открытые по замыслу: сайт работает
   в браузере, и любой посетитель видит их в сетевых запросах. Ключ только называет проект.
   Данные защищают правила доступа в самой базе (см. supabase/schema.sql): без входа таблицы
   недоступны, после входа человек видит одну строку — свою.

   Сюда НЕЛЬЗЯ класть:
   - секретный ключ (начинается с sb_secret_) и ключ service_role — они дают полный доступ в обход правил;
   - пароль базы данных и строку подключения postgres://…;
   - адреса почты и пароли пользователей, в том числе тестовых.
   Перед сборкой это проверяет scripts/check-secrets.mjs, а сайт отказывается работать с секретным ключом.

   Для локальной проверки с другим проектом значения можно подменить в файле .env.local
   (он не попадает в репозиторий), образец — .env.example. Пустое значение отключает учётные записи. */
const env = import.meta.env;

export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? 'https://goqruouhlsemfkperjmd.supabase.co').trim().replace(/\/+$/, '');
export const SUPABASE_KEY = (env.VITE_SUPABASE_KEY ?? 'sb_publishable_V1yzS4h1jmoCKaOCztEe4g_QNjVMyI9').trim();

/* Секретный ключ в браузере — авария, а не настройка: с ним учётные записи просто не включаются */
function looksSecret(key) {
  if (/^sb_secret_/i.test(key)) return true;
  const part = key.split('.')[1];
  if (!part) return false;
  try { return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon'; } catch { return false; }
}

/* Включены ли учётные записи. Если нет, сайт работает как раньше: всё хранится в браузере */
export const CLOUD = Boolean(/^https:\/\/[^/]+$/.test(SUPABASE_URL) && SUPABASE_KEY && !looksSecret(SUPABASE_KEY));

/* Редакции документов: дата попадает в запись о согласии при регистрации. Меняете текст документа — меняйте дату */
export const DOCS = { terms: '2026-10-07', privacy: '2026-10-09' };

/* Ключи в хранилище браузера. Полный список с назначением показан в политике конфиденциальности */
export const KEYS = { state: 'nownow.v1', auth: 'nownow.auth', base: 'nownow.base', flow: 'nownow.flow', consent: 'nownow.consent' };

export const MIN_PASSWORD = 8;
