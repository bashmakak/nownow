import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { COURSE_BY, PUBLIC, REC_ORDER, TOPIC_BY, coursesOf, isPublic, tagsOf } from '../data';
import { useStore, status, nCourses, norm } from '../lib/store.js';
import { useUI, useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { CourseCard, EmptyState } from '../components/Cards.jsx';
import { TopicsPanel } from '../components/TopicsPanel.jsx';

const PAGE = 12;
const SELECTS = [
  ['format', 'Формат', [['', 'Любой формат'], ['theory', 'Теория'], ['practice', 'Практика'], ['case', 'Кейс']]],
  ['level', 'Уровень', [['', 'Любой уровень'], ['1', 'Начальный'], ['2', 'Средний'], ['3', 'Продвинутый']]],
  ['status', 'Статус', [['', 'Все курсы'], ['new', 'Не начатые'], ['progress', 'В процессе'], ['done', 'Пройденные']]],
  ['sort', 'Сортировка', [['', 'Сначала рекомендуемые'], ['az', 'По названию']]],
];

export default function Catalog() {
  useTitle('Каталог');
  const s = useStore();
  const ui = useUI();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE);
  const input = useRef(null);
  const f = Object.fromEntries(['q', 'topic', 'tag', 'format', 'level', 'status', 'sort'].map(k => [k, params.get(k) || '']));

  // состояние фильтров хранится в адресе: страницей можно поделиться
  const set = patch => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
    setShown(PAGE);
  };

  useEffect(() => { if (loc.state?.focusSearch) input.current?.focus({ preventScroll: true }); }, [loc.state]);

  const q = norm(f.q);
  let list = REC_ORDER.map(slug => COURSE_BY[slug]).filter(c => isPublic(TOPIC_BY[c.topic]));
  if (q) list = list.filter(c => norm([c.title, c.summary, c.tags.join(' '), TOPIC_BY[c.topic].title].join(' ')).includes(q));
  if (f.topic) list = list.filter(c => c.topic === f.topic);
  if (f.tag) list = list.filter(c => c.tags.includes(f.tag));
  if (f.format) list = list.filter(c => c.format === f.format);
  if (f.level) list = list.filter(c => String(c.level) === f.level);
  if (f.status) list = list.filter(c => status(s, c.slug) === f.status);
  if (f.sort === 'az') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'ru'));

  // в ряду чипов сначала темы, где человек уже занимался
  const started = PUBLIC.filter(t => coursesOf(t.slug).some(c => status(s, c.slug) !== 'new'));
  let chips = started.concat(PUBLIC.filter(t => !started.includes(t))).slice(0, 7);
  if (f.topic && TOPIC_BY[f.topic] && !chips.some(t => t.slug === f.topic)) chips = [TOPIC_BY[f.topic], ...chips.slice(0, 6)];

  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">Каталог</h1>
          <p className="lead">Все курсы длятся 30 минут. Выберите тему или найдите курс по слову.</p>
        </header>
        <div className="cat-tools">
          <form className="field cat-search" role="search" onSubmit={e => e.preventDefault()}>
            <label className="sr" htmlFor="cat-q">Поиск курсов</label>
            <Icon name="search" size={18} />
            <input className="input" id="cat-q" ref={input} type="search" placeholder="Поиск курсов…" autoComplete="off"
              value={f.q} onChange={e => set({ q: e.target.value })} />
          </form>
          <div className="chips chips-scroll" role="group" aria-label="Темы" id="cat-topics">
            <button type="button" className="chip" aria-pressed={!f.topic} onClick={() => set({ topic: '', tag: '' })}>Все</button>
            {chips.map(t => (
              <button key={t.slug} type="button" className="chip" aria-pressed={f.topic === t.slug} onClick={() => set({ topic: t.slug, tag: '' })}>{t.title}</button>
            ))}
            <button type="button" className="chip" aria-haspopup="dialog"
              onClick={() => ui.open(<TopicsPanel selected={f.topic} onPick={slug => { set({ topic: slug, tag: '' }); ui.close(); }} />)}>
              Ещё темы <Icon name="chevron-down" size={15} />
            </button>
          </div>
          <div className="filters">
            {SELECTS.map(([key, label, opts]) => (
              <span className="sel" key={key}>
                <label className="sr" htmlFor={`f-${key}`}>{label}</label>
                <select id={`f-${key}`} value={f[key]} onChange={e => set({ [key]: e.target.value })}>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Icon name="chevron-down" size={16} />
              </span>
            ))}
            <span className="cat-count" id="cat-count" aria-live="polite">Найдено: {nCourses(list.length)}</span>
          </div>
        </div>

        <div id="cat-results">
          {f.topic && TOPIC_BY[f.topic] && (
            <div className="chips" role="group" aria-label="Подтемы" style={{ marginBottom: 20 }}>
              {tagsOf(f.topic).map(t => (
                <button key={t} type="button" className="chip" aria-pressed={f.tag === t} onClick={() => set({ tag: f.tag === t ? '' : t })}>{t}</button>
              ))}
            </div>
          )}
          {list.length ? (
            <>
              <div className="cards">{list.slice(0, shown).map(c => <CourseCard course={c} key={c.slug} />)}</div>
              {list.length > shown && (
                <div className="cat-more">
                  <button type="button" className="btn btn-secondary" onClick={() => setShown(n => n + PAGE)}>
                    Показать ещё {Math.min(PAGE, list.length - shown)}
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState title="Ничего не нашлось" text="Попробуйте другое слово или сбросьте фильтры.">
              <button type="button" className="btn btn-secondary" onClick={() => { setParams({}, { replace: true }); setShown(PAGE); input.current?.focus(); }}>Сбросить фильтры</button>
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}
