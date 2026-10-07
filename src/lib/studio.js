import { client, getAuth } from './cloud.js';
import { cleanLesson } from './lesson-format.js';

/* ===== Мастерская и модерация: запросы к базе =====
   Всё здесь выполняется от имени вошедшего человека. Что ему можно, решает база (правила доступа
   и функции в supabase/migrations): сайт только просит. Автор не может одобрить свой урок, начислить
   себе искры или назначить себя модератором, даже если изменит код страницы.

   Искры — внутренние очки. Размеры начислений заданы в базе; здесь они только для подписей. */
export const SPARKS = { published: 50, learner: 5, useful: 2 };

const TEXT = {
  23505: 'Такое имя автора уже занято. Выберите другое.',
  23514: 'Имя не подходит: от 2 до 40 знаков, без слов «редакция», «модератор», «NowNow».',
  23503: 'Сначала укажите имя автора.',
  54000: 'Достигнут предел: не больше 50 уроков у автора и не больше 5 одновременно на проверке.',
  42501: 'На это действие нет прав.',
  P0002: 'Урок уже в другом состоянии. Обновите страницу.',
  22023: 'Урок заполнен не полностью, или не написан комментарий.',
};
/* Ошибка базы → понятный текст */
function fail(error) {
  const code = error && error.code;
  const text = TEXT[code] || (/fetch|network|load failed/i.test((error && error.message) || '') ? 'Нет связи с сервером. Проверьте интернет и попробуйте снова.' : 'Не получилось. Попробуйте ещё раз чуть позже.');
  return Object.assign(new Error(text), { code });
}
async function run(fn) {
  let res;
  try { res = await fn(await client()); } catch (e) { throw fail(e); }
  if (res.error) throw fail(res.error);
  return res.data;
}
const me = () => { const u = getAuth().user; if (!u) throw Object.assign(new Error('Войдите в учётную запись.'), { code: 'guest' }); return u.id; };

/* ---------- автор ---------- */
export const myAuthor = () => run(c => c.from('authors').select('user_id,name,bio,created_at').eq('user_id', me()).maybeSingle());
export async function saveAuthor({ name, bio }, exists) {
  const row = { name: name.trim().replace(/\s+/g, ' ').slice(0, 40), bio: (bio || '').trim().slice(0, 300) };
  if (exists) await run(c => c.from('authors').update(row).eq('user_id', me()).select('user_id'));
  else await run(c => c.from('authors').insert({ user_id: me(), ...row }).select('user_id'));
  return row;
}
export const amModerator = () => run(c => c.rpc('is_moderator')).then(Boolean, () => false);

/* Уроки автора: черновики и то, что из них опубликовано */
export async function myLessons() {
  const id = me();
  const [drafts, pub] = await Promise.all([
    run(c => c.from('lesson_drafts').select('id,data,status,note,submitted_at,reviewed_at,updated_at').eq('author_id', id).order('updated_at', { ascending: false })),
    run(c => c.from('lessons_public').select('id,slug,title,hidden,hidden_by,learners,useful,published_at,updated_at').eq('author_id', id)),
  ]);
  const live = Object.fromEntries(pub.map(p => [p.id, p]));
  return drafts.map(d => ({ ...d, data: cleanLesson(d.data), live: live[d.id] || null }));
}
export async function getLesson(id) {
  const [d, pub] = await Promise.all([
    run(c => c.from('lesson_drafts').select('id,data,status,note,submitted_at,reviewed_at,updated_at').eq('id', id).eq('author_id', me()).maybeSingle()),
    run(c => c.from('lessons_public').select('id,slug,hidden,hidden_by,learners,useful').eq('id', id).maybeSingle()),
  ]);
  return d ? { ...d, data: cleanLesson(d.data), live: pub || null } : null;
}
export const createLesson = data => run(c => c.from('lesson_drafts').insert({ author_id: me(), data: cleanLesson(data) }).select('id')).then(rows => rows[0].id);
/* Сохранить черновик. Возвращает его статус: после правки одобренного урока он снова становится черновиком */
export const saveLesson = (id, data) => run(c => c.from('lesson_drafts').update({ data: cleanLesson(data) }).eq('id', id).select('status')).then(rows => {
  if (!rows.length) throw fail({ code: 'P0002' });
  return rows[0].status;
});
export const removeLesson = id => run(c => c.from('lesson_drafts').delete().eq('id', id).select('id'));
export const submitLesson = id => run(c => c.rpc('submit_lesson', { p_id: id }));
export const withdrawLesson = id => run(c => c.rpc('withdraw_lesson', { p_id: id }));
export const setHidden = (id, hidden) => run(c => c.rpc('set_lesson_hidden', { p_id: id, p_hidden: hidden }));

/* Баланс искр и последние начисления */
export async function wallet() {
  const [sum, rows] = await Promise.all([
    run(c => c.rpc('wallet')),
    run(c => c.from('ledger').select('id,amount,kind,lesson_id,created_at').order('id', { ascending: false }).limit(30)),
  ]);
  return { balance: 0, published: 0, learners: 0, useful: 0, ...(sum || {}), rows };
}

/* ---------- модератор ---------- */
export const reviewQueue = () => run(c => c.from('lesson_drafts').select('id,data,submitted_at,author_id,author:authors!lesson_drafts_author_id_fkey(name,bio)').eq('status', 'review').order('submitted_at', { ascending: true }))
  .then(rows => rows.map(r => ({ ...r, data: cleanLesson(r.data) })));
export const reviewLesson = (id, approve, note) => run(c => c.rpc('review_lesson', { p_id: id, p_approve: approve, p_note: note || '' }));
export const openReports = () => run(c => c.from('reports').select('id,reason,created_at,lesson:lessons_public!reports_lesson_id_fkey(id,slug,title,hidden)').eq('resolved', false).order('created_at', { ascending: true }));
export const resolveReport = id => run(c => c.from('reports').update({ resolved: true }).eq('id', id).select('id'));
export const allPublished = () => run(c => c.from('lessons_public').select('id,slug,title,topic,hidden,hidden_by,learners,useful,published_at,author:authors!lessons_public_author_id_fkey(name)').order('published_at', { ascending: false }).limit(300));
