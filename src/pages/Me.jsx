import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BLOCKS, COURSE_BY, TOPIC_BY, VERSION, WITH_FULL, about } from '../data';
import { useStore, update, statusOf, splitKey, setVersion, streak, dayKey, activeDay, plural, resetAll, applyTheme } from '../lib/store.js';
import { useUI, useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { CourseCard, EmptyState, KeyCard, ProgressLine, ThemeControl } from '../components/Cards.jsx';
import { Achievements, Bolts, XpBar, achievementCount } from '../components/GameUI.jsx';
import { TRAINERS } from '../data/trainers.js';
import { dailyDone, xpOf } from '../lib/game.js';
import { CLOUD } from '../config.js';
import { useAuth } from '../lib/cloud.js';
import { AccountPanel, downloadMyData } from '../components/Account.jsx';

function Calendar({ activity }) {
  const now = new Date(), dow = (now.getDay() + 6) % 7;
  const start = new Date(now); start.setDate(now.getDate() - dow - 21);
  const cells = [...Array(28)].map((_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dayKey(d), on = activeDay(activity[k]), isToday = k === dayKey(now);
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
  const account = useAuth();
  const signedIn = CLOUD && Boolean(account.user);
  const [ask, setAsk] = useState(false);
  // ключ прогресса — это урок и его версия; of(k) разбирает ключ
  const of = k => { const [slug, v] = splitKey(k), c = COURSE_BY[slug]; return { slug, v, c, A: about(c, v), tail: c.full ? ` · ${VERSION[v].toLowerCase()} версия` : '' }; };
  const all = Object.keys(s.courses).filter(k => COURSE_BY[splitKey(k)[0]]);
  const inprog = all.filter(k => statusOf(s, ...splitKey(k)) === 'progress').sort((a, b) => (s.courses[b].touched || 0) - (s.courses[a].touched || 0));
  // одна карточка на урок: если пройдены обе версии, берём ту, что пройдена позже
  const passed = all.filter(k => s.courses[k].completed).sort((a, b) => s.courses[b].completed - s.courses[a].completed);
  const completed = passed.filter((k, i) => passed.findIndex(x => splitKey(x)[0] === splitKey(k)[0]) === i);
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return s.activity[dayKey(d)] || { sec: 0, blocks: 0 }; });
  const wkMin = Math.round(week.reduce((x, y) => x + y.sec, 0) / 60), wkBlocks = week.reduce((x, y) => x + y.blocks, 0), st = streak(s);
  const notes = Object.entries(s.notes).map(([k, v]) => [k.slice(0, k.lastIndexOf(':')), +k.slice(k.lastIndexOf(':') + 1), v])
    .filter(([k, , v]) => v && v.trim() && COURSE_BY[splitKey(k)[0]]);
  const reflects = all.filter(k => (s.courses[k].reflect || '').trim());
  const sheets = all.filter(k => of(k).A.sheet.length && Object.values(s.courses[k].work || {}).some(v => (v || '').trim()));
  const bookmarks = s.bookmarks.filter(k => COURSE_BY[k]);
  const cont = inprog[0] && of(inprog[0]);
  const [achGot, achAll] = achievementCount(s);
  const played = TRAINERS.filter(t => s.game.best[t.id]);
  const label = { textDecoration: 'none' };

  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">{s.name ? `Здравствуйте, ${s.name}` : 'Кабинет'}</h1>
          <p className="lead">{signedIn
            ? 'Прогресс, закладки и заметки сохраняются в учётной записи и доступны на других устройствах.'
            : CLOUD ? <>Прогресс, закладки и заметки хранятся в этом браузере. <Link to="/signup">Создайте учётную запись</Link>, чтобы они сохранялись в облаке.</>
              : 'Прогресс, закладки и заметки хранятся только в этом браузере.'}</p>
        </header>

        <div className="dash">
          <div className="stack" style={{ gap: 20, minWidth: 0 }}>
            <div className="panel">
              <div className="panel-head"><h2 className="h3">Продолжить</h2></div>
              {cont ? (
                <div className="cont">
                  <div className="stack" style={{ gap: 8, minWidth: 0 }}>
                    <span className="label">{TOPIC_BY[cont.c.topic].title}{cont.tail}</span>
                    <Link to={`/courses/${cont.slug}`} className="h4" style={{ color: 'var(--text)', textDecoration: 'none' }}>{cont.c.title}</Link>
                    <ProgressLine course={cont.c} version={cont.v} />
                  </div>
                  <Link className="btn btn-primary" to={`/learn/${cont.slug}/${cont.v}`}>Продолжить</Link>
                </div>
              ) : (
                <>
                  <p className="muted">Незавершённых уроков нет. Выберите курс: первый блок займёт меньше минуты.</p>
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
                <p className="muted" style={{ fontSize: 14 }}>{st ? 'День засчитан, если пройден блок урока или раунд в тренажёре.' : 'Пройдите блок урока или раунд в тренажёре, чтобы начать серию.'}</p>
              </div>
            </div>
            <Calendar activity={s.activity} />
          </div>
        </div>

        <div className="group" id="me-game">
          <div className="stack" style={{ gap: 20 }}>
            <div className="panel">
              <div className="panel-head"><h2 className="h3">Уровень и опыт</h2></div>
              <div className="me-level">
                <div>
                  <XpBar xp={xpOf(s)} />
                  <p className="muted" style={{ fontSize: 14 }}>Опыт дают пройденные уроки, верные ответы в проверке, задания в уроках и раунды в тренажёрах.</p>
                </div>
                <div>
                  {played.length > 0 ? (
                    <ul className="bests" aria-label="Лучшие результаты в тренажёрах">
                      {played.map(t => <li key={t.id}><Link to={`/train/${t.id}`}>{t.title}</Link><Bolts n={s.game.best[t.id].bolts} size={16} /><b className="num">{s.game.best[t.id].score}</b></li>)}
                    </ul>
                  ) : <p className="muted">В тренажёрах вы ещё не играли. Раунд из восьми заданий занимает около двух минут.</p>}
                  <div className="row">
                    <Link className="btn btn-secondary" to="/train"><Icon name="gamepad-2" size={17} />{dailyDone(s) ? 'Тренажёры' : 'Тренировка дня'}</Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><h2 className="h3">Достижения</h2><span className="muted num" id="ach-count">{achGot} из {achAll}</span></div>
              <Achievements />
            </div>
          </div>
        </div>

        <div className="group">
          <h2 className="h3" style={{ marginBottom: 18 }}>Ключевые знания</h2>
          {completed.length ? (
            <div className="kgrid" data-rv-kids="">
              {completed.map(k => (
                <div className="stack" style={{ gap: 8, minWidth: 0 }} key={k}>
                  <Link className="label" to={`/courses/${of(k).slug}`} style={label}>{of(k).c.title}</Link>
                  <KeyCard course={of(k).A} />
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
              {notes.map(([k, i, v]) => (
                <div className="note-item" key={`${k}:${i}`}>
                  <Link className="label" to={`/courses/${of(k).slug}`} style={label}>{of(k).c.title}{of(k).tail} · блок {i + 1}, {BLOCKS[i].label.toLowerCase()}</Link>
                  <p>{v}</p>
                </div>
              ))}
              {sheets.map(k => (
                <div className="note-item" key={`w-${k}`}>
                  <Link className="label" to={`/courses/${of(k).slug}`} style={label}>{of(k).c.title} · рабочий лист</Link>
                  <dl className="sheet-answers">
                    {of(k).A.sheet.map((label, i) => ((s.courses[k].work[i] || '').trim() ? (
                      <div key={label}><dt>{label}</dt><dd>{s.courses[k].work[i]}</dd></div>
                    ) : null))}
                  </dl>
                </div>
              ))}
              {reflects.map(k => (
                <div className="note-item" key={`r-${k}`}>
                  <Link className="label" to={`/courses/${of(k).slug}`} style={label}>{of(k).c.title}{of(k).tail} · ответ в практике</Link>
                  <p>{s.courses[k].reflect}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {CLOUD && (
          <div className="group" id="me-account">
            <h2 className="h3" style={{ marginBottom: 18 }}>Учётная запись</h2>
            <div style={{ maxWidth: 640 }}><AccountPanel /></div>
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
            <div className="form-row">
              <span style={{ fontWeight: 500, fontSize: 14.5 }} id="me-ver">Версия уроков по умолчанию</span>
              <div>
                <div className="seg-ctl" role="radiogroup" aria-labelledby="me-ver">
                  {['short', 'full'].map(v => (
                    <button key={v} type="button" role="radio" aria-checked={(s.version || 'short') === v} onClick={() => setVersion(v)}>{VERSION[v]}</button>
                  ))}
                </div>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>Короткая даёт главное за несколько минут, полная разбирает тему подробно. Полная версия пока есть у {WITH_FULL.length} {plural(WITH_FULL.length, ['урока', 'уроков', 'уроков'])}: у остальных откроется короткая. На странице урока версию можно сменить.</p>
            </div>
            <div className="form-row"><span style={{ fontWeight: 500, fontSize: 14.5 }}>Тема оформления</span><div><ThemeControl /></div></div>
            <div className="form-row">
              <span style={{ fontWeight: 500, fontSize: 14.5 }}>Данные</span>
              {ask ? (
                <>
                  <p className="muted">{signedIn
                    ? 'Прогресс, закладки и заметки будут удалены из учётной записи на всех ваших устройствах. Сама учётная запись останется. Вернуть данные не получится.'
                    : 'Прогресс, закладки и заметки будут удалены из этого браузера. Вернуть их не получится.'}</p>
                  <div className="row">
                    <button type="button" className="btn btn-danger" id="me-reset-yes" onClick={() => { resetAll(); applyTheme(s.theme); setAsk(false); toast(signedIn ? 'Прогресс удалён' : 'Прогресс удалён из этого браузера'); }}>
                      <Icon name="trash-2" size={17} />Удалить всё
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setAsk(false)}>Отмена</button>
                  </div>
                </>
              ) : (
                <div className="row">
                  <button type="button" className="btn btn-secondary" id="me-export" onClick={() => downloadMyData()}>Скачать мои данные</button>
                  <button type="button" className="btn btn-ghost" id="me-reset" onClick={() => setAsk(true)}>Сбросить прогресс</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
