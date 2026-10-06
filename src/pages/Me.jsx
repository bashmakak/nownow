import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BLOCKS, COURSE_BY, TOPIC_BY } from '../data';
import { useStore, update, status, streak, dayKey, plural, resetAll, applyTheme } from '../lib/store.js';
import { useUI, useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { CourseCard, EmptyState, KeyCard, ProgressLine, ThemeControl } from '../components/Cards.jsx';

function Calendar({ activity }) {
  const now = new Date(), dow = (now.getDay() + 6) % 7;
  const start = new Date(now); start.setDate(now.getDate() - dow - 21);
  const cells = [...Array(28)].map((_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dayKey(d), on = Boolean(activity[k] && activity[k].blocks > 0), isToday = k === dayKey(now);
    return { k, n: d.getDate(), on, isToday, fut: d > now && !isToday, title: d.toLocaleDateString('ru-RU') + (on ? ': есть занятие' : '') };
  });
  return (
    <div className="cal" role="img" aria-label="Календарь занятий за четыре недели">
      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <span className="wd" key={d}>{d}</span>)}
      {cells.map(c => <span key={c.k} className={`${c.on ? 'on ' : ''}${c.isToday ? 'today ' : ''}${c.fut ? 'fut' : ''}`} title={c.title}>{c.n}</span>)}
    </div>
  );
}

export default function Me() {
  useTitle('Кабинет');
  const s = useStore();
  const { toast } = useUI();
  const [ask, setAsk] = useState(false);
  const all = Object.keys(s.courses).filter(k => COURSE_BY[k]);
  const inprog = all.filter(k => status(s, k) === 'progress').sort((a, b) => (s.courses[b].touched || 0) - (s.courses[a].touched || 0));
  const completed = all.filter(k => s.courses[k].completed).sort((a, b) => s.courses[b].completed - s.courses[a].completed);
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return s.activity[dayKey(d)] || { sec: 0, blocks: 0 }; });
  const wkMin = Math.round(week.reduce((x, y) => x + y.sec, 0) / 60), wkBlocks = week.reduce((x, y) => x + y.blocks, 0), st = streak(s);
  const notes = Object.entries(s.notes).filter(([k, v]) => v && v.trim() && COURSE_BY[k.split(':')[0]]);
  const reflects = all.filter(k => (s.courses[k].reflect || '').trim());
  const sheets = all.filter(k => COURSE_BY[k].practice.sheet && Object.values(s.courses[k].work || {}).some(v => (v || '').trim()));
  const bookmarks = s.bookmarks.filter(k => COURSE_BY[k]);
  const cont = inprog[0] && COURSE_BY[inprog[0]];
  const label = { textDecoration: 'none' };

  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">{s.name ? `Здравствуйте, ${s.name}` : 'Кабинет'}</h1>
          <p className="lead">Прогресс, закладки и заметки хранятся только в этом браузере.</p>
        </header>

        <div className="dash">
          <div className="stack" style={{ gap: 20, minWidth: 0 }}>
            <div className="panel">
              <div className="panel-head"><h2 className="h3">Продолжить</h2></div>
              {cont ? (
                <div className="cont">
                  <div className="stack" style={{ gap: 8, minWidth: 0 }}>
                    <span className="label">{TOPIC_BY[cont.topic].title}</span>
                    <Link to={`/courses/${cont.slug}`} className="h4" style={{ color: 'var(--text)', textDecoration: 'none' }}>{cont.title}</Link>
                    <ProgressLine slug={cont.slug} />
                  </div>
                  <Link className="btn btn-primary" to={`/learn/${cont.slug}`}>Продолжить</Link>
                </div>
              ) : (
                <>
                  <p className="muted">Незавершённых уроков нет. Выберите курс, первый блок займёт две минуты.</p>
                  <div><Link className="btn btn-primary" to="/courses">Выбрать курс</Link></div>
                </>
              )}
            </div>
            <div className="panel">
              <div className="panel-head"><h2 className="h3">За 7 дней</h2></div>
              <div className="stats">
                <div className="stat"><b>{wkMin}</b><span>{plural(wkMin, ['минута', 'минуты', 'минут'])} обучения</span></div>
                <div className="stat"><b>{wkBlocks}</b><span>{plural(wkBlocks, ['блок пройден', 'блока пройдено', 'блоков пройдено'])}</span></div>
                <div className="stat"><b>{completed.length}</b><span>{plural(completed.length, ['курс пройден', 'курса пройдено', 'курсов пройдено'])} всего</span></div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h2 className="h3">Серия</h2></div>
            <div className="streak-row">
              <Mark size={44} fill={st ? 'url(#nv-g)' : 'currentColor'} />
              <div>
                <b>{st}</b> <span className="muted">{plural(st, ['день', 'дня', 'дней'])} подряд</span>
                <p className="muted" style={{ fontSize: 14 }}>{st ? 'День засчитан, если пройден хотя бы один блок.' : 'Пройдите один блок сегодня, чтобы начать серию.'}</p>
              </div>
            </div>
            <Calendar activity={s.activity} />
          </div>
        </div>

        <div className="group">
          <h2 className="h3" style={{ marginBottom: 18 }}>Ключевые знания</h2>
          {completed.length ? (
            <div className="kgrid">
              {completed.map(k => (
                <div className="stack" style={{ gap: 8, minWidth: 0 }} key={k}>
                  <Link className="label" to={`/courses/${k}`} style={label}>{COURSE_BY[k].title}</Link>
                  <KeyCard course={COURSE_BY[k]} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Здесь появятся карточки" text="После каждого пройденного урока сюда попадает его главный вывод с действием на сегодня.">
              <Link className="btn btn-secondary" to="/courses">Перейти в каталог</Link>
            </EmptyState>
          )}
        </div>

        <div className="group">
          <h2 className="h3" style={{ marginBottom: 18 }}>Закладки</h2>
          {bookmarks.length
            ? <div className="cards">{bookmarks.map(k => <CourseCard course={COURSE_BY[k]} key={k} />)}</div>
            : <EmptyState title="Закладок пока нет" text="Здесь появятся курсы, к которым вы захотите вернуться. Нажмите на значок закладки на карточке курса." />}
        </div>

        {(notes.length > 0 || reflects.length > 0 || sheets.length > 0) && (
          <div className="group">
            <h2 className="h3" style={{ marginBottom: 6 }}>Заметки и ответы</h2>
            <div className="panel" style={{ gap: 0, paddingBlock: 6 }}>
              {notes.map(([k, v]) => {
                const [slug, i] = k.split(':');
                return (
                  <div className="note-item" key={k}>
                    <Link className="label" to={`/courses/${slug}`} style={label}>{COURSE_BY[slug].title} · блок {+i + 1}, {BLOCKS[+i].label.toLowerCase()}</Link>
                    <p>{v}</p>
                  </div>
                );
              })}
              {sheets.map(k => (
                <div className="note-item" key={`w-${k}`}>
                  <Link className="label" to={`/courses/${k}`} style={label}>{COURSE_BY[k].title} · рабочий лист</Link>
                  <dl className="sheet-answers">
                    {COURSE_BY[k].practice.sheet.map((f, i) => ((s.courses[k].work[i] || '').trim() ? (
                      <div key={f.label}><dt>{f.label}</dt><dd>{s.courses[k].work[i]}</dd></div>
                    ) : null))}
                  </dl>
                </div>
              ))}
              {reflects.map(k => (
                <div className="note-item" key={`r-${k}`}>
                  <Link className="label" to={`/courses/${k}`} style={label}>{COURSE_BY[k].title} · ответ в практике</Link>
                  <p>{s.courses[k].reflect}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="group">
          <h2 className="h3" style={{ marginBottom: 18 }}>Настройки</h2>
          <div className="panel" style={{ maxWidth: 640 }}>
            <div className="form-row">
              <label htmlFor="me-name">Как к вам обращаться</label>
              <input className="input" id="me-name" type="text" maxLength={40} autoComplete="given-name" placeholder="Имя"
                value={s.name} onChange={e => update(d => { d.name = e.target.value; })} />
            </div>
            <div className="form-row"><span style={{ fontWeight: 500, fontSize: 14.5 }}>Тема оформления</span><div><ThemeControl /></div></div>
            <div className="form-row">
              <span style={{ fontWeight: 500, fontSize: 14.5 }}>Данные</span>
              {ask ? (
                <>
                  <p className="muted">Прогресс, закладки и заметки будут удалены из этого браузера. Вернуть их не получится.</p>
                  <div className="row">
                    <button type="button" className="btn btn-danger" onClick={() => { resetAll(); applyTheme(s.theme); setAsk(false); toast('Прогресс удалён из этого браузера'); }}>
                      <Icon name="trash-2" size={17} />Удалить всё
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setAsk(false)}>Отмена</button>
                  </div>
                </>
              ) : (
                <div><button type="button" className="btn btn-secondary" onClick={() => setAsk(true)}>Сбросить прогресс</button></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
